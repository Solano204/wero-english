import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { conteo } from '@/utils/text';
import { AppState, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { Button, EmptyState, ErrorCarga, Header, Icon, Screen, Presionable } from '@/components/base';
import { Trozos, useReaccion, estiloResultado, useEfectoResultado } from '@/components/feedback';
import { FichaPar } from '@/components/juegos/pares/FichaPar';
import { FichasJugadas } from '@/components/juegos/pares/FichasJugadas';
import { distribuir, type Rect } from '@/components/juegos/pares/geometria';
import { RelojRonda } from '@/components/juegos/pares/RelojRonda';
import { SegmentosPares } from '@/components/juegos/pares/SegmentosPares';
import { buildTablero, sonPareja } from '@/domain/pares';
import { useNivel } from './useNivel';
import { applyGameGrade } from '@/db/games';
import { getRandomEntries } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, radius, space, aparecer, aparecerZoom, motionDuration, motionEasing } from '@/theme';
import type { Entry, NivelPares, ParFicha, ParesTablero } from '@/types';
import type { RootStackParams } from '@/navigation/routes';
import { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Pares'>;

/**
 * Tope duro: si el audio no carga o se atora, esto suelta la pausa igual.
 * Tiene que alcanzar para efecto + inglés + español.
 */
const PAUSA_MAXIMA_MS = 10000;
/** Bloqueo de "Saltar" contra doble toque. */
const SALTAR_DEBOUNCE_MS = 400;

/**
 * P-25, Pares.
 *
 * La mecánica que la competencia usa con una lista fija de palabras
 * sueltas. Aquí el tablero se arma con las tarjetas que le tocan hoy al
 * usuario, así que juntar dos fichas mueve su cola de repaso de verdad.
 *
 * Se califica como reconocimiento y nunca da grado 4: resolver un
 * tablero de ocho fichas por descarte no es recordar la frase en frío.
 *
 * Quedarse sin jugadas no acaba la partida. El tablero se queda como
 * está, se muestra lo que faltaba y se pasa al resumen. No hay derrota.
 */
export function ParesScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const { nivel, config, filtrar } = useNivel('pares', params?.nivel);
  const nv = config as NivelPares | null;
  const filter = useSettingsStore((s) => s.filter);
  // Se necesita oír bien las dos frases al acertar un par: la música,
  // aunque fuera baja, competiría justo en ese momento.
  useMusicaPantalla('silencio');

  const [tablero, setTablero] = useState<ParesTablero | null>(null);
  // Cara y cubitos. El numero se relanza en cada respuesta;
  // no hace falta apagarlo con un temporizador.
  const reaccion = useReaccion();
  const [elegida, setElegida] = useState<ParFicha | null>(null);
  const [resueltas, setResueltas] = useState<number[]>([]);
  const [fallando, setFallando] = useState<string[]>([]);
  const [jugadas, setJugadas] = useState(0);
  // Pausa al acertar un par: congela reloj y tablero mientras se oyen
  // las dos frases. `parPausado` trae lo que muestra el overlay.
  const [enPausa, setEnPausa] = useState(false);
  const [parPausado, setParPausado] = useState<{ en: string; es: string } | null>(
    null
  );
  const [saltando, setSaltando] = useState(false);
  // Lo que mide la zona del tablero: de ahí sale dónde cae cada ficha.
  const [zona, setZona] = useState({ ancho: 0, alto: 0 });
  const geo = useMemo(
    () => distribuir(tablero?.fichas.length ?? 0, zona.ancho, zona.alto),
    [tablero?.fichas.length, zona.ancho, zona.alto]
  );
  const alMedirZona = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setZona((z) => (z.ancho === width && z.alto === height ? z : { ancho: width, alto: height }));
  }, []);

  const empezoEn = useRef(Date.now());
  // Las fichas solo traen entryId, no el Entry completo: hace falta este
  // mapa para llegar a audio_en/audio_es al emparejar.
  const entradas = useRef(new Map<number, Entry>());
  // Se incrementa cada vez que arranca o se corta una pausa: una
  // secuencia vieja que sigue esperando un await la revisa y aborta.
  const pausaToken = useRef(0);
  const limiteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saltarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Evita setState después de desmontar mientras una pausa sigue en
  // camino (los await de audio no se cancelan solos).
  const montado = useRef(true);

  /** Corta la voz en camino y quita la pausa. Saltar, salir o background. */
  const abortarPausa = useCallback(() => {
    pausaToken.current++;
    audio.stop();
    if (limiteTimer.current) clearTimeout(limiteTimer.current);
    if (montado.current) {
      setEnPausa(false);
      setParPausado(null);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') abortarPausa();
    });
    return () => {
      montado.current = false;
      sub.remove();
      abortarPausa();
      if (saltarTimer.current) clearTimeout(saltarTimer.current);
    };
  }, [abortarPausa]);

  const carga = useCarga(
    async () => {
      if (!user || !nv) return;
      const pool = await getRandomEntries(filter(), 120, {
        maxWords: 4,
        maxLen: 30,
      });
      const dentro = filtrar(pool, nv.pares);
      entradas.current = new Map(dentro.map((e) => [e.id, e]));
      const t = buildTablero(dentro, nv.pares);
      // El colchón de jugadas lo pone el nivel, no el dominio.
      setTablero({ ...t, jugadas: nv.jugadas });
      empezoEn.current = Date.now();
    },
    [user, filter, nv, filtrar]
  );
  const loading = carga.estado === 'cargando';

  /**
   * Al acertar: suena el efecto de acierto, luego la frase en inglés y
   * luego la española, con el tablero y el reloj congelados. Se puede
   * cortar en cualquier punto (saltarPausa, salir, background); un tope
   * de PAUSA_MAXIMA_MS evita quedarse pegado si el audio no carga.
   */
  const pausarConVoz = useCallback(
    async (entry: Entry) => {
      const miToken = ++pausaToken.current;
      setParPausado({ en: entry.phrase, es: entry.spanish_main });
      setEnPausa(true);

      // Se guarda también en local: el finally solo debe apagar SU tope,
      // no el de una pausa nueva que arrancó mientras esta se desenredaba.
      const limite = setTimeout(() => {
        if (pausaToken.current === miToken) abortarPausa();
      }, PAUSA_MAXIMA_MS);
      limiteTimer.current = limite;

      try {
        await audio.playRoundResultBilingue(true, entry.audio_en, entry.audio_es);
      } finally {
        clearTimeout(limite);
        // Si nadie más tomó el token (ni saltarPausa ni un abort externo
        // ya lo hicieron), esta es la que cierra la pausa.
        if (pausaToken.current === miToken && montado.current) {
          setEnPausa(false);
          setParPausado(null);
        }
      }
    },
    [abortarPausa]
  );

  const saltarPausa = useCallback(() => {
    if (saltando) return;
    setSaltando(true);
    if (saltarTimer.current) clearTimeout(saltarTimer.current);
    saltarTimer.current = setTimeout(() => setSaltando(false), SALTAR_DEBOUNCE_MS);
    abortarPausa();
  }, [saltando, abortarPausa]);

  const tocar = useCallback(
    (f: ParFicha) => {
      if (!tablero || fallando.length > 0 || enPausa) return;
      if (resueltas.includes(f.entryId)) return;

      if (!elegida) {
        haptics.tapLight();
        void audio.playTap();
        setElegida(f);
        return;
      }

      if (elegida.id === f.id) {
        setElegida(null);
        return;
      }

      setJugadas((j) => j + 1);

      if (sonPareja(elegida, f)) {
        haptics.success();
      reaccion.celebra();
        setResueltas((prev) => [...prev, f.entryId]);
        setElegida(null);
        const entry = entradas.current.get(f.entryId);
        // Siempre se oyen las dos frases al acertar un par, sin mirar
        // "Audio automático": es la recompensa del acierto, no un
        // extra opcional. El efecto de acierto lo pone la propia pausa:
        // sonarlo aparte cancelaría la frase en inglés (playSfx hace
        // stop()). Solo si no hay voz que oír suena suelto.
        if (entry && (entry.audio_en || entry.audio_es)) {
          void pausarConVoz(entry);
        } else {
          void audio.playSuccess();
        }
        if (user) {
          void applyGameGrade(
            user.id,
            f.entryId,
            true,
            Date.now() - empezoEn.current,
            'reconocer'
          );
        }
        return;
      }

      // Falló: las dos parpadean en ámbar y se sueltan. Ámbar y no
      // rojo, por la misma razón que en la tarjeta de estudio. Sin
      // pausa ni voz: solo el SFX suave, igual que siempre.
      haptics.failure();
      void audio.playFail();
      setFallando([elegida.id, f.id]);
      if (user) {
        void applyGameGrade(
          user.id,
          elegida.entryId,
          false,
          Date.now() - empezoEn.current,
          'reconocer'
        );
      }
      setTimeout(() => {
        setFallando([]);
        setElegida(null);
      }, 520);
    },
    [tablero, elegida, resueltas, fallando, enPausa, user, pausarConVoz]
  );

  const terminar = useCallback(() => {
    audio.stop();
    nav.replace('GameEnd', {
      juego: 'pares',
      rondas: tablero?.totalPares ?? 0,
      aciertos: resueltas.length,
      nivel: nivel ?? undefined,
    });
  }, [nav, tablero, resueltas.length, nivel]);

  useEffect(() => {
    if (!tablero || enPausa) return;
    // Si el último par disparó pausarConVoz, esto no corre hasta que
    // enPausa vuelva a false: primero se oye la frase, después se
    // termina la partida.
    if (resueltas.length > 0 && resueltas.length === tablero.totalPares) {
      const t = setTimeout(terminar, 620);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [resueltas.length, tablero, terminar, enPausa]);

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Pares" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Pares" />
        <View style={styles.center}>
          <Text style={styles.loading}>Repartiendo fichas…</Text>
        </View>
      </Screen>
    );
  }

  if (!tablero || tablero.totalPares < 3) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Pares" />
        <EmptyState
          icon="warning"
          title="No se pudo armar el tablero"
          body="No hay frases cortas suficientes con los filtros que traes puestos."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  const restantes = Math.max(0, tablero.jugadas - jugadas);

  return (
    <Screen padded={false}>
      <Trozos disparo={reaccion.trozos} tinte={color.world.dia_a_dia} x="50%" y="50%" />
      <View style={styles.top}>
        <Header
          onBack={() => nav.goBack()}
          title={nivel ? `Nivel ${nivel}` : undefined}
          right={<SegmentosPares total={tablero.totalPares} resueltos={resueltas.length} />}
        />
        {nv ? (
          <View style={styles.reloj}>
            <RelojRonda
              segundos={nv.segundosTablero}
              llave={nivel ?? 0}
              // Al resolver el tablero el reloj se congela: seguir
              // contando mientras corre la animación de salida haría
              // perder partidas ya ganadas. También se congela mientras
              // se oye la voz de un par recién acertado.
              pausado={enPausa || resueltas.length >= (tablero?.totalPares ?? 0)}
              onFin={terminar}
            />
          </View>
        ) : null}
      </View>

      <Text style={styles.instruccion}>Junta cada frase con lo que significa</Text>

      <View style={styles.zona} onLayout={alMedirZona} pointerEvents={enPausa ? 'none' : 'auto'}>
        {zona.ancho > 0 ? (
          <ScrollView
            scrollEnabled={geo.desborda}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.zonaContenido}
          >
            <View style={{ width: zona.ancho, height: geo.altoContenido }}>
              {tablero.fichas.map((f, i) => {
                const recta = geo.rectas[i];
                if (!recta) return null;
                if (resueltas.includes(f.entryId)) {
                  return <FichaResuelta key={f.id} texto={f.texto} recta={recta} />;
                }
                return (
                  <FichaPar
                    key={f.id}
                    ficha={f}
                    recta={recta}
                    elevada={elegida?.id === f.id}
                    falla={fallando.includes(f.id)}
                    // La segunda ficha de la jugada es la que se sacude.
                    sacude={fallando[1] === f.id}
                    onPress={() => tocar(f)}
                  />
                );
              })}
            </View>
          </ScrollView>
        ) : null}
      </View>

      {enPausa && parPausado ? (
        <Animated.View
          entering={aparecer()}
          style={styles.overlay}
          pointerEvents="box-none"
        >
          <Animated.View entering={aparecerZoom()} style={styles.overlayCard}>
            <Text style={styles.overlayEn}>{parPausado.en}</Text>
            <Text style={styles.overlayEs}>{parPausado.es}</Text>
            <Presionable
              onPress={saltarPausa}
              disabled={saltando}
              accessibilityRole="button"
              accessibilityLabel="Saltar"
              hitSlop={8}
              style={styles.saltar}
            >
              <Text style={styles.saltarTexto}>Saltar</Text>
              <Icon name="chevron-right" size="sm" color={color.textFaint} />
            </Presionable>
          </Animated.View>
        </Animated.View>
      ) : null}

      <View style={styles.pie}>
        <View style={styles.jugadasFila}>
          {restantes > 0 ? <FichasJugadas total={tablero.jugadas} restantes={restantes} /> : null}
          <Text style={[styles.jugadas, restantes > 0 && styles.jugadasAlLado]}>
            {restantes > 0
              ? `Te quedan ${conteo(restantes, 'jugada')}`
              : 'Se acabaron las jugadas, pero el tablero se queda'}
          </Text>
        </View>
        <Button
          label={restantes > 0 ? 'Dejarlo aquí' : 'Ver cómo me fue'}
          variant={restantes > 0 ? 'ghost' : 'primary'}
          onPress={terminar}
          full
        />
      </View>
    </Screen>
  );
}

/** Coloca una ficha en la posición que le calculó `distribuir`. */
function enRecta(r: Rect): ViewStyle {
  return { position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height };
}

/**
 * Ficha de un par resuelto: pulso con el color de acierto y, pasado `base`,
 * se apaga. Se queda como hueco invisible para que el tablero no se mueva.
 */
function FichaResuelta({ texto, recta }: { texto: string; recta: Rect }) {
  const { estilo, acierto } = useEfectoResultado();
  const opacidad = useSharedValue(1);

  useEffect(() => {
    acierto();
    opacidad.value = withDelay(
      motionDuration.base,
      withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
    );
  }, [acierto, opacidad]);

  const apagado = useAnimatedStyle(() => ({ opacity: opacidad.value }));

  return (
    <Animated.View style={[styles.ficha, enRecta(recta), estiloResultado.acierto, apagado, estilo]}>
      <Text style={styles.fichaTexto} numberOfLines={3}>
        {texto}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  reloj: { marginTop: space.sm, marginBottom: space.md },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    backgroundColor: color.velo,
  },
  overlayCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: space.sm,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  overlayEn: {
    fontSize: font.size.xl,
    fontFamily: font.family.display,
    color: color.text,
    textAlign: 'center',
  },
  overlayEs: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
  },
  saltar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.sm, padding: space.sm },
  saltarTexto: {
    fontSize: font.size.sm,
    color: color.textFaint,
    fontFamily: font.family.bodyStrong,
  },
  instruccion: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.textMuted,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  zona: { flex: 1, marginHorizontal: space.lg },
  zonaContenido: { flexGrow: 1, justifyContent: 'center' },
  ficha: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fichaTexto: {
    color: color.text,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    textAlign: 'center',
  },
  pie: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  jugadasFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  jugadas: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textMuted,
    textAlign: 'center',
    flex: 1,
  },
  jugadasAlLado: { textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
});
