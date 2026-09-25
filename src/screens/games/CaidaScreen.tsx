import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button, EmptyState, ErrorCarga, Header, Icon, Screen, Presionable } from '@/components/base';
import { Trozos, useReaccion, estiloResultado, type Resultado } from '@/components/feedback';
import { buildRounds } from '@/domain/caida';
import { useNivel } from './useNivel';
import { applyGameGrade } from '@/db/games';
import { getRandomEntries } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import {
  color,
  depth,
  font,
  motionDuration,
  motionSpring,
  radius,
  shadow,
  space,
} from '@/theme';
import { plural, useMovimientoReducido } from '@/utils';
import type { CaidaRound, Entry, NivelCaida } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Caida'>;

/**
 * Tope duro de la pausa de fin de ronda (acierto o fallo): si el audio
 * no carga o se atora, esto la suelta de todos modos. Tiempo de sobra
 * para oír la frase completa en inglés y en español.
 */
const PAUSA_MAXIMA_MS = 10000;
/** Respiro tras la voz antes de seguir (próxima ronda o resultado). */
const RESPIRO_MS = 300;
/** Bloqueo de "Siguiente" en la pausa contra doble toque. */
const AVANZAR_DEBOUNCE_MS = 400;

/**
 * Cuánto baja la tarjeta antes de tocar el piso.
 *
 * Antes era un 42% de la pantalla con tope de 380, y en teléfonos altos
 * eso dejaba a la tarjeta parándose a media pantalla mientras la línea
 * roja seguía mucho más abajo: parecía que perdías sin que nada te
 * tocara. Ahora se mide de verdad la pista, así que la tarjeta aterriza
 * exactamente sobre la línea.
 */

/**
 * P-26, Caída.
 *
 * La frase aparece arriba y dos tarjetas bajan. Hay que tocar la
 * correcta antes de que lleguen al piso. Tocar la equivocada, o dejar
 * que aterricen, acaba la partida.
 *
 * Es el único modo de la app donde se puede perder, y es a pedido
 * expreso. Para que no contradiga la regla de que nada se castiga,
 * perder aquí no toca nada de afuera: no rompe la racha ni marca la
 * tarjeta peor de lo que la marcaría una respuesta equivocada en una
 * sesión normal. Se pierde la partida, no el avance.
 *
 * La animación corre en el hilo de UI con reanimated. Con un
 * setInterval en JS la caída se traba justo cuando SQLite escribe la
 * respuesta anterior, que es exactamente el peor momento.
 */
export function CaidaScreen() {
  useKeepAwake();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const { nivel, config, filtrar } = useNivel('caida', params?.nivel);
  const nv = config as NivelCaida | null;
  const filter = useSettingsStore((s) => s.filter);
  const autoAudio = useSettingsStore((s) => s.autoAudio);
  const reducido = useMovimientoReducido();
  // Se necesita oír bien la voz de la pausa al acertar: la música,
  // aunque fuera baja, competiría justo en ese momento.
  useMusicaPantalla('silencio');

  const [rounds, setRounds] = useState<CaidaRound[]>([]);
  // Cara y cubitos. El numero se relanza en cada respuesta;
  // no hace falta apagarlo con un temporizador.
  const reaccion = useReaccion();
  const [idx, setIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [perdio, setPerdio] = useState(false);
  const [fallada, setFallada] = useState<string | null>(null);
  // Ronda y texto de la ficha acertada: la ronda evita que un texto repetido marque la siguiente.
  const [acertada, setAcertada] = useState<string | null>(null);
  // Pausa al acertar: congela la caída y bloquea las fichas mientras se
  // oye la frase en inglés y su traducción.
  const [enPausa, setEnPausa] = useState(false);
  const [pausaInfo, setPausaInfo] = useState<{ en: string; es: string } | null>(
    null
  );
  const [avanzando, setAvanzando] = useState(false);

  const y = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const overlayScale = useSharedValue(0.92);
  // Alto real de la pista, medido en pantalla. No se puede calcular:
  // depende del alto del encabezado, de la frase (que a veces son dos
  // renglones) y de la barra de gestos del teléfono.
  const [altoPista, setAltoPista] = useState(0);
  const empezoEn = useRef(Date.now());
  const round = rounds[idx];

  // `aciertos` en un ref: al ir a GameEnd tras la pausa, el closure del
  // momento en que se acertó ya puede estar viejo. El ref siempre trae
  // el valor real.
  const aciertosRef = useRef(0);
  // Qué hacer cuando la pausa termina (ronda siguiente, o pasar al
  // resultado si se perdió), fuera de React: lo lee tanto el fin
  // natural de la voz como "Siguiente".
  const pausaCtx = useRef<(() => void) | null>(null);
  // Token de la pausa vigente: uno nuevo invalida cualquier voz o
  // temporizador en camino de una pausa anterior.
  const pausaToken = useRef(0);
  const limiteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avanzarDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') return;
      // No se avanza de ronda estando en background: solo se corta la
      // voz y se congela donde está. "Siguiente" sigue ahí al volver.
      audio.stop();
      if (limiteTimer.current) clearTimeout(limiteTimer.current);
      cancelAnimation(y);
    });
    return () => {
      montado.current = false;
      sub.remove();
      pausaToken.current++;
      audio.stop();
      if (limiteTimer.current) clearTimeout(limiteTimer.current);
      if (avanzarDebounce.current) clearTimeout(avanzarDebounce.current);
      cancelAnimation(y);
    };
  }, [y]);

  const carga = useCarga(
    async () => {
      if (!user || !nv) return;
      const pool = await getRandomEntries(filter(), 200, { maxLen: 32 });
      const dentro = filtrar(pool, nv.rondas);
      setRounds(
        buildRounds(dentro, nv.rondas, {
          inicialMs: nv.caidaInicialMs,
          minimaMs: nv.caidaMinimaMs,
          aceleraMs: nv.aceleraMs,
        })
      );
    },
    [user, filter, nv, filtrar]
  );
  const loading = carga.estado === 'cargando';

  /**
   * Termina la pausa de fin de ronda y corre lo que tocaba: ronda
   * siguiente, o pasar al resultado si se perdió. La llaman tanto el
   * final natural de la voz como "Siguiente" y el tope de
   * PAUSA_MAXIMA_MS; el token evita que dos de ellos avancen dos veces.
   */
  const avanzarTrasPausa = useCallback((miToken: number) => {
    if (pausaToken.current !== miToken) return;
    pausaToken.current++;
    if (limiteTimer.current) clearTimeout(limiteTimer.current);
    audio.stop();

    const continuar = pausaCtx.current;
    pausaCtx.current = null;
    if (!montado.current) return;
    setEnPausa(false);
    setPausaInfo(null);
    continuar?.();
  }, []);

  /**
   * Pausa de fin de ronda: congela la caída, muestra la frase correcta y
   * dice la frase completa en inglés y en español, siempre (sin mirar
   * "Audio automático") y sin importar si la ronda se ganó o se perdió.
   * Al terminar (voz completa, tope de PAUSA_MAXIMA_MS, o "Siguiente" a
   * mano) corre `continuar`.
   */
  const pausarConVoz = useCallback(
    async (entry: Entry, correct: boolean, continuar: () => void) => {
      const miToken = ++pausaToken.current;
      pausaCtx.current = continuar;
      setPausaInfo({ en: entry.phrase, es: entry.spanish_main });
      setEnPausa(true);

      limiteTimer.current = setTimeout(
        () => avanzarTrasPausa(miToken),
        PAUSA_MAXIMA_MS
      );

      await audio.playRoundResultBilingue(correct, entry.audio_en, entry.audio_es);
      if (pausaToken.current !== miToken) return; // ya lo cerró otra vía

      await new Promise((r) => setTimeout(r, RESPIRO_MS));
      avanzarTrasPausa(miToken);
    },
    [avanzarTrasPausa]
  );

  /**
   * Se acabó el tiempo: las tarjetas tocaron el piso.
   *
   * No puede disparar esto durante la pausa de un acierto: la animación
   * ya está cancelada en ese momento (cancelAnimation en responder), así
   * que este callback nunca llega a correr con `terminada: true`. La
   * bandera es un cinturón extra por si algún callback viejo se cuela.
   */
  const seCayo = useCallback(() => {
    if (enPausa || !round) return;
    setFallada(null);
    setAcertada(null);
    haptics.failure();
    void pausarConVoz(round.entry, false, () => setPerdio(true));
  }, [round, enPausa, pausarConVoz]);

  // Arranca la caída de cada ronda.
  useEffect(() => {
    if (!round || perdio || enPausa) return;

    empezoEn.current = Date.now();
    y.value = 0;
    if (altoPista <= 0) return;

    y.value = withTiming(
      altoPista,
      { duration: round.duracionMs, easing: Easing.linear },
      (terminada) => {
        if (terminada) runOnJS(seCayo)();
      }
    );

    // Aviso corto de que algo empieza a caer, antes de la frase.
    void audio.playCaidaPieza();
    if (autoAudio) void audio.play(round.entry.audio_en);

    return () => cancelAnimation(y);
  }, [round, perdio, enPausa, y, autoAudio, seCayo, altoPista]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  const overlayAnim = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: overlayScale.value }],
  }));

  useEffect(() => {
    if (enPausa) {
      overlayOpacity.value = reducido
        ? 1
        : withTiming(1, { duration: motionDuration.rapido });
      overlayScale.value = reducido ? 1 : withSpring(1, motionSpring.rebote);
    } else {
      overlayOpacity.value = reducido ? 0 : withTiming(0, { duration: motionDuration.rapido });
      overlayScale.value = 0.92;
    }
  }, [enPausa, reducido, overlayOpacity, overlayScale]);

  /** Botón "Siguiente ›" de la pausa: corta la voz y avanza ya. */
  const tocarSiguienteEnPausa = useCallback(() => {
    if (avanzando) return;
    setAvanzando(true);
    if (avanzarDebounce.current) clearTimeout(avanzarDebounce.current);
    avanzarDebounce.current = setTimeout(
      () => setAvanzando(false),
      AVANZAR_DEBOUNCE_MS
    );
    avanzarTrasPausa(pausaToken.current);
  }, [avanzando, avanzarTrasPausa]);

  const responder = useCallback(
    (texto: string) => {
      if (!round || perdio || enPausa) return;
      cancelAnimation(y);

      const bien = texto === round.correcta;
      const ms = Date.now() - empezoEn.current;

      if (user) {
        void applyGameGrade(user.id, round.entry.id, bien, ms, 'reconocer');
      }

      if (!bien) {
        haptics.failure();
        setFallada(texto);
        void pausarConVoz(round.entry, false, () => setPerdio(true));
        return;
      }

      setAcertada(`${idx}|${texto}`);
      haptics.success();
      reaccion.celebra();
      const totalAciertos = aciertosRef.current + 1;
      aciertosRef.current = totalAciertos;
      setAciertos(totalAciertos);
      const esUltima = idx + 1 >= rounds.length;

      void pausarConVoz(round.entry, true, () => {
        if (esUltima) {
          nav.replace('GameEnd', {
            juego: 'caida',
            rondas: rounds.length,
            aciertos: totalAciertos,
            nivel: nivel ?? undefined,
          });
        } else {
          setIdx((i) => i + 1);
        }
      });
      // Caída no tiene vidas: cualquier fallo termina la corrida, así
      // que `aciertos` mientras se sigue jugando ES la racha. Cada
      // tercera se marca con un sonido distinto al acierto normal: se
      // dispara después del SFX de acierto de pausarConVoz para que lo
      // reemplace (stop() del combo corta el que ya estaba sonando).
      if (totalAciertos % 3 === 0) void audio.playCombo();
    },
    [round, perdio, enPausa, y, user, idx, rounds.length, nav, nivel, pausarConVoz]
  );

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Caída" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Caída" />
        <View style={styles.center}>
          <Text style={styles.loading}>Preparando la caída…</Text>
        </View>
      </Screen>
    );
  }

  if (rounds.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Caída" />
        <EmptyState
          title="No se pudo armar la partida"
          body="No hay frases suficientes con los filtros que traes puestos."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  if (perdio) {
    return (
      <Screen
        footer={
          // Fijo abajo: una frase larga en finCard (o un "Elegiste: ..."
          // largo) no debe poder empujar estos dos botones fuera de la
          // pantalla en un equipo chico.
          <View style={styles.finBotones}>
            <Button
              icon="repeat"
              accessibilityLabel="Otra partida"
              onPress={() => {
                setIdx(0);
                setAciertos(0);
                setFallada(null);
                setAcertada(null);
                setPerdio(false);
              }}
              full
              size="lg"
            />
            <Button
              label="Ver cómo me fue"
              variant="secondary"
              onPress={() =>
                nav.replace('GameEnd', {
                  juego: 'caida',
                  rondas: rounds.length,
                  aciertos,
                  nivel: nivel ?? undefined,
                })
              }
              full
            />
          </View>
        }
      >
        <Header onBack={() => nav.goBack()} title="Caída" />
        <ScrollView
          style={styles.finWrap}
          contentContainerStyle={styles.finWrapContenido}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.finNum} maxFontSizeMultiplier={1.2}>{aciertos}</Text>
          <Text style={styles.finLabel}>
            {plural(aciertos, 'frase seguida', 'frases seguidas')}
          </Text>

          {round ? (
            <View style={styles.finCard}>
              <Text style={styles.finFrase}>{round.entry.phrase}</Text>
              <Text style={styles.finBien}>{round.correcta}</Text>
              {fallada ? (
                <Text style={styles.finMal}>Elegiste: {fallada}</Text>
              ) : (
                <Text style={styles.finMal}>Se te fue el tiempo</Text>
              )}
            </View>
          ) : null}

          <Text style={styles.finNota}>
            Aquí sí se pierde la partida, pero nada más. Tu racha y tu avance
            siguen igual.
          </Text>
        </ScrollView>
      </Screen>
    );
  }

  if (!round) return null;

  const izquierda = round.correctaIzquierda ? round.correcta : round.falsa;
  const derecha = round.correctaIzquierda ? round.falsa : round.correcta;

  return (
    <Screen padded={false}>
      <Trozos disparo={reaccion.trozos} tinte={color.correct} x="50%" y="62%" />
      <View style={styles.top}>
        <Header
          onBack={() => nav.goBack()}
          title={nivel ? `Nivel ${nivel}` : undefined}
          right={<Text style={styles.marcador} maxFontSizeMultiplier={1.2}>{aciertos}</Text>}
        />
        <Text style={styles.frase}>{round.entry.phrase}</Text>
        <Text style={styles.instruccion}>
          Toca el significado antes de que lleguen abajo
        </Text>
      </View>

      <View
        style={styles.pista}
        onLayout={(e) => {
          // Se resta el alto de la ficha y el del piso para que la
          // tarjeta se detenga tocándolo, no atravesándolo.
          const alto = e.nativeEvent.layout.height - ALTO_FICHA - ALTO_PISO;
          setAltoPista(Math.max(80, alto));
        }}
      >
        <Animated.View style={[styles.fila, anim]}>
          <Ficha
            texto={izquierda}
            resultado={resultadoFicha(izquierda, fallada, acertada, idx)}
            onPress={() => void responder(izquierda)}
          />
          <Ficha
            texto={derecha}
            resultado={resultadoFicha(derecha, fallada, acertada, idx)}
            onPress={() => void responder(derecha)}
          />
        </Animated.View>
        <View style={styles.piso} />
      </View>

      {enPausa && pausaInfo ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <Animated.View style={[styles.overlayCard, overlayAnim]}>
            <Text style={styles.overlayEn}>{pausaInfo.en}</Text>
            <Text style={styles.overlayEs}>{pausaInfo.es}</Text>
            <Presionable
              onPress={tocarSiguienteEnPausa}
              disabled={avanzando}
              accessibilityRole="button"
              accessibilityLabel="Siguiente"
              hitSlop={8}
              style={styles.siguiente}
            >
              <Text style={styles.siguienteTexto}>Siguiente</Text>
              <Icon name="chevron-right" size="sm" color={color.textFaint} />
            </Presionable>
          </Animated.View>
        </View>
      ) : null}
    </Screen>
  );
}

function resultadoFicha(
  texto: string,
  fallada: string | null,
  acertada: string | null,
  ronda: number
): Resultado | null {
  if (fallada === texto) return 'fallo';
  return acertada === `${ronda}|${texto}` ? 'acierto' : null;
}

function Ficha({
  texto,
  onPress,
  resultado,
}: {
  texto: string;
  onPress: () => void;
  resultado: Resultado | null;
}) {
  return (
    <Presionable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={texto}
      resultado={resultado}
      style={[styles.ficha, resultado && estiloResultado[resultado]]}
    >
      <Text style={styles.fichaTexto} numberOfLines={4}>
        {texto}
      </Text>
    </Presionable>
  );
}

/** Deben coincidir con los estilos de abajo. */
const ALTO_FICHA = 96;
const ALTO_PISO = 24;

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  marcador: {
    fontSize: font.size.xl,
    fontFamily: font.family.display,
    color: color.accent,
  },
  frase: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
    textAlign: 'center',
  },
  instruccion: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.xs,
  },
  pista: { flex: 1, justifyContent: 'flex-start', paddingTop: space.lg },
  fila: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  ficha: {
    flex: 1,
    minHeight: 96,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderBottomWidth: depth.sm,
    borderBottomColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
    ...shadow.card,
  },
  fichaTexto: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    textAlign: 'center',
  },
  piso: {
    height: 4,
    marginBottom: space.md,
    backgroundColor: color.riskStrong,
    marginTop: space.lg,
    marginHorizontal: space.lg,
    borderRadius: radius.pill,
  },
  finWrap: { flex: 1 },
  finWrapContenido: {
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  finNum: {
    fontSize: 64,
    letterSpacing: 64 * -0.015,
    fontFamily: font.family.display,
    color: color.accent,
  },
  finLabel: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  finCard: {
    alignSelf: 'stretch',
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    gap: 4,
    marginTop: space.lg,
    ...shadow.card,
  },
  finFrase: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
  },
  finBien: { fontFamily: font.family.body, fontSize: font.size.md, color: color.correct },
  finMal: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.wrong },
  finNota: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.md,
  },
  // El footer de Screen ya pone el padding y separa del contenido de
  // arriba: aquí solo el espacio entre los dos botones.
  finBotones: { gap: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
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
    ...shadow.card,
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
  siguiente: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.sm, padding: space.sm },
  siguienteTexto: {
    fontSize: font.size.sm,
    color: color.textFaint,
    fontFamily: font.family.bodyStrong,
  },
});
