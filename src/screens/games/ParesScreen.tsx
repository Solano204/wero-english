import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { conteo } from '@/utils/text';
import { AppState, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/components/base';
import { Trozos, useReaccion } from '@/components/feedback';
import { CableSenal, type ParIndices } from '@/components/juegos/pares/CableSenal';
import { FichaPar } from '@/components/juegos/pares/FichaPar';
import { FichasJugadas } from '@/components/juegos/pares/FichasJugadas';
import { distribuir, type Rect } from '@/components/juegos/pares/geometria';
import { RelojRonda } from '@/components/juegos/pares/RelojRonda';
import { SegmentosPares, centroSegmento } from '@/components/juegos/pares/SegmentosPares';
import { Sello } from '@/components/juegos/pares/Sello';
import { TarjetaFusion } from '@/components/juegos/pares/TarjetaFusion';
import { buildTablero, sonPareja } from '@/domain/pares';
import { useNivel } from './useNivel';
import { applyGameGrade } from '@/db/games';
import { getRandomEntries } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, space } from '@/theme';
import type { Entry, NivelPares, ParFicha, ParesTablero } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Pares'>;

/** Un par que se acaba de juntar y cuya voz aún suena: la tarjeta de fusión lo lleva hasta su segmento. */
interface Fusion {
  a: number;
  b: number;
  /** El segmento del progreso que se enciende cuando la tarjeta llega. */
  segmento: number;
  entry: Entry;
}

/**
 * Tope duro: si el audio no carga o se atora, esto suelta la pausa igual.
 * Tiene que alcanzar para efecto + inglés + español.
 */
const PAUSA_MAXIMA_MS = 10000;
/** Tope de la unión de un par (el cable tarda unos 370 ms): pasado esto se suelta el tablero igual. */
const UNION_MAXIMA_MS = 1500;
/** Tope del vuelo de la tarjeta de un par después de su voz: entrada de 450 ms más 320 ms de vuelo, con margen. */
const FUSION_MAXIMA_MS = 2000;
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
  // las dos frases. La tarjeta de fusión es lo que se ve mientras dura.
  const [enPausa, setEnPausa] = useState(false);
  const [saltando, setSaltando] = useState(false);
  // Lo que mide la zona del tablero: de ahí sale dónde cae cada ficha.
  const [zona, setZona] = useState({ x: 0, y: 0, ancho: 0, alto: 0 });
  const geo = useMemo(
    () => distribuir(tablero?.fichas.length ?? 0, zona.ancho, zona.alto),
    [tablero?.fichas.length, zona.ancho, zona.alto]
  );
  const alMedirZona = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setZona((z) => (z.x === x && z.y === y && z.ancho === width && z.alto === height ? z : { x, y, ancho: width, alto: height }));
  }, []);
  // La capa donde se funden las fichas mide lo que toda la pantalla; `segmentos` es la esquina de la fila de progreso en esa capa.
  const capaRef = useRef<View>(null);
  const segmentosRef = useRef<View>(null);
  const scrollY = useRef(0);
  const [capa, setCapa] = useState({ ancho: 0, alto: 0 });
  const [segmentos, setSegmentos] = useState<{ x: number; y: number } | null>(null);
  const medirSegmentos = useCallback(() => {
    const raiz = capaRef.current;
    if (!raiz) return;
    segmentosRef.current?.measureLayout(
      raiz,
      (x, y) => setSegmentos((s) => (s && s.x === x && s.y === y ? s : { x, y })),
      () => undefined
    );
  }, []);
  const alMedirCapa = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setCapa((c) => (c.ancho === width && c.alto === height ? c : { ancho: width, alto: height }));
      medirSegmentos();
    },
    [medirSegmentos]
  );
  const alScrollear = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);
  // Las dos fichas de un acierto siguen en el tablero mientras el cable las une, y el par sigue
  // «en vuelo» (sin encender su segmento) hasta que su tarjeta llega.
  const [union, setUnion] = useState<ParIndices | null>(null);
  const [fusion, setFusion] = useState<Fusion | null>(null);
  const alTerminarUnion = useCallback(() => setUnion(null), []);
  const alAterrizar = useCallback(() => setFusion(null), []);
  // Si el aviso del cable no llega (app en segundo plano a media unión), el tablero no se queda bloqueado.
  useEffect(() => {
    if (!union) return undefined;
    const t = setTimeout(() => setUnion(null), UNION_MAXIMA_MS);
    return () => clearTimeout(t);
  }, [union]);
  const libres = useMemo(() => tablero?.fichas.map((f) => !resueltas.includes(f.entryId)) ?? [], [tablero, resueltas]);
  const fallo = useMemo(() => {
    if (!tablero || fallando.length !== 2) return null;
    const a = tablero.fichas.findIndex((f) => f.id === fallando[0]);
    const b = tablero.fichas.findIndex((f) => f.id === fallando[1]);
    return a >= 0 && b >= 0 ? { a, b } : null;
  }, [tablero, fallando]);

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
    if (montado.current) setEnPausa(false);
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
        if (pausaToken.current === miToken && montado.current) setEnPausa(false);
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
      if (!tablero || fallando.length > 0 || enPausa || union || fusion) return;
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
        const a = tablero.fichas.findIndex((x) => x.id === elegida.id);
        const b = tablero.fichas.findIndex((x) => x.id === f.id);
        setUnion({ a, b });
        setElegida(null);
        const entry = entradas.current.get(f.entryId);
        // Siempre se oyen las dos frases al acertar un par, sin mirar
        // "Audio automático": es la recompensa del acierto, no un
        // extra opcional. El efecto de acierto lo pone la propia pausa:
        // sonarlo aparte cancelaría la frase en inglés (playSfx hace
        // stop()). Solo si no hay voz que oír suena suelto.
        if (entry && (entry.audio_en || entry.audio_es)) {
          setFusion({ a, b, segmento: resueltas.length, entry });
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
    [tablero, elegida, resueltas, fallando, enPausa, union, fusion, user, pausarConVoz]
  );

  // El cable arrastra: soltar sobre una ficha es el segundo toque, y una ficha que no tenía
  // par elegida al arrancar el arrastre es el primero.
  const tocarIndice = useCallback(
    (i: number) => {
      const f = tablero?.fichas[i];
      if (f) tocar(f);
    },
    [tablero, tocar]
  );
  const cancelarArrastre = useCallback(() => setElegida(null), []);

  const terminar = useCallback(() => {
    audio.stop();
    nav.replace('GameEnd', {
      juego: 'pares',
      rondas: tablero?.totalPares ?? 0,
      aciertos: resueltas.length,
      nivel: nivel ?? undefined,
    });
  }, [nav, tablero, resueltas.length, nivel]);

  // Si la tarjeta no avisa que llegó, el tablero no se queda bloqueado (el vuelo tarda unos 800 ms tras la voz).
  useEffect(() => {
    if (!fusion || enPausa) return undefined;
    const t = setTimeout(() => setFusion(null), FUSION_MAXIMA_MS);
    return () => clearTimeout(t);
  }, [fusion, enPausa]);

  useEffect(() => {
    if (!tablero || enPausa || fusion) return;
    // Si el último par disparó pausarConVoz, esto no corre hasta que
    // enPausa vuelva a false y su tarjeta llegue al segmento: primero se
    // oye la frase, después se termina la partida.
    if (resueltas.length > 0 && resueltas.length === tablero.totalPares) {
      const t = setTimeout(terminar, 620);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [resueltas.length, tablero, terminar, enPausa, fusion]);

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

  // Dónde están las fichas de un par en la capa de la pantalla (el tablero está centrado en su zona y puede ir scrolleado).
  const desplazo = Math.max(0, (zona.alto - geo.altoContenido) / 2);
  const enCapa = (i: number): Rect | null => {
    const r = geo.rectas[i];
    return r ? { x: zona.x + r.x, y: zona.y + desplazo + r.y - scrollY.current, width: r.width, height: r.height } : null;
  };
  const fichaA = fusion ? tablero.fichas[fusion.a] : undefined;
  const fichaB = fusion ? tablero.fichas[fusion.b] : undefined;
  const rectaA = fusion ? enCapa(fusion.a) : null;
  const rectaB = fusion ? enCapa(fusion.b) : null;
  const meta = fusion ? centroSegmento(fusion.segmento) : null;
  const destino =
    segmentos && meta ? { x: segmentos.x + meta.x, y: segmentos.y + meta.y } : { x: capa.ancho - space.xl, y: space.xl };

  return (
    <Screen padded={false}>
      <View ref={capaRef} style={styles.capa} onLayout={alMedirCapa}>
        <Trozos disparo={reaccion.trozos} tinte={color.world.dia_a_dia} x="50%" y="50%" />
        <View style={styles.top}>
          <Header
            onBack={() => nav.goBack()}
            title={nivel ? `Nivel ${nivel}` : undefined}
            right={
              <View ref={segmentosRef} collapsable={false} onLayout={medirSegmentos}>
                <SegmentosPares total={tablero.totalPares} resueltos={resueltas.length - (fusion ? 1 : 0)} />
              </View>
            }
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
              onScroll={alScrollear}
              scrollEventThrottle={16}
            >
              <CableSenal
                ancho={zona.ancho}
                alto={geo.altoContenido}
                rectas={geo.rectas}
                ancla={elegida ? tablero.fichas.findIndex((f) => f.id === elegida.id) : -1}
                libres={libres}
                bloqueado={enPausa || fallando.length > 0 || union !== null || fusion !== null}
                arrastrable={!geo.desborda}
                union={union}
                fallo={fallo}
                onIniciar={tocarIndice}
                onSoltar={tocarIndice}
                onCancelar={cancelarArrastre}
                onUnionLista={alTerminarUnion}
              >
                {tablero.fichas.map((f, i) => {
                  const recta = geo.rectas[i];
                  if (!recta) return null;
                  const uniendo = union !== null && (union.a === i || union.b === i);
                  if (resueltas.includes(f.entryId) && !uniendo) return <Sello key={f.id} recta={recta} />;
                  return (
                    <FichaPar
                      key={f.id}
                      ficha={f}
                      recta={recta}
                      elevada={uniendo || elegida?.id === f.id}
                      falla={fallando.includes(f.id)}
                      // La segunda ficha de la jugada es la que se sacude.
                      sacude={fallando[1] === f.id}
                      onPress={() => tocar(f)}
                    />
                  );
                })}
              </CableSenal>
            </ScrollView>
          ) : null}
        </View>

        {fusion && fichaA && fichaB && capa.ancho > 0 ? (
          <TarjetaFusion
            fichas={[fichaA, fichaB]}
            rectas={rectaA && rectaB ? [rectaA, rectaB] : null}
            capa={capa}
            destino={destino}
            entry={fusion.entry}
            iniciar={union === null}
            saliendo={!enPausa}
            onAterrizo={alAterrizar}
          />
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
          {enPausa ? (
            // «Saltar» ocupa el lugar del botón de salida, en la zona del pulgar y por encima del velo de la tarjeta.
            <Button label="Saltar" variant="ghost" icon="chevron-right" iconAlFinal onPress={saltarPausa} disabled={saltando} full />
          ) : (
            <Button
              label={restantes > 0 ? 'Dejarlo aquí' : 'Ver cómo me fue'}
              variant={restantes > 0 ? 'ghost' : 'primary'}
              onPress={terminar}
              full
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  capa: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  reloj: { marginTop: space.sm, marginBottom: space.md },
  instruccion: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.textMuted,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  zona: { flex: 1, marginHorizontal: space.lg },
  zonaContenido: { flexGrow: 1, justifyContent: 'center' },
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
