import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  FadeIn,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';
import { Button, Card, EmptyState, ErrorCarga, Header, Icon, ProgressBar, Screen } from '@/components/base';
import { AudioButton } from '@/components/card';
import { Estrellas, Trozos, useReaccion } from '@/components/feedback';
import {
  clone,
  createBoard,
  findMatches,
  hayMovimiento,
  rebarajar,
  resolve,
  sonVecinas,
  swap,
  type Board,
} from '@/domain/match3';
import { applyGameGrade } from '@/db/games';
import { getRandomEntries } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { shuffle } from '@/utils/array';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, depth, font, radius, shadow, space } from '@/theme';
import { useNivel } from './useNivel';
import type { DulceObjetivo, Entry, NivelDulces } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Dulces'>;

/** Valores de respaldo si niveles.json no cargó. */
const COLS_DEF = 7;
const ROWS_DEF = 8;
const COLORES_DEF = 5;
const JUGADAS_DEF = 22;
const META_DEF = 9;

const ANCHO = Dimensions.get('window').width;

/** Tope duro de la secuencia de la pregunta: si el audio no carga, se suelta igual. */
const RESPUESTA_MAXIMA_MS = 6000;
/** Pausa entre el inglés y el español al acertar. */
const PAUSA_ENTRE_IDIOMAS_MS = 250;
/** Cuánto se deja ver la marca sin voz (Voz automática apagada). */
const SIN_VOZ_VISUAL_MS = 900;
/** Bloqueo de "Seguir" en la pregunta contra doble toque. */
const AVANZAR_DEBOUNCE_MS = 400;
/** Entre matches muy seguidos, no suena más de una voz cada tanto. */
const VOZ_MATCH_THROTTLE_MS = 700;

/** El lado de la pieza depende de cuántas columnas pida el nivel. */
function ladoPara(cols: number): number {
  return Math.floor((ANCHO - space.lg * 2 - (cols - 1) * 4) / cols);
}

/**
 * P-27, Dulces.
 *
 * Un tres en línea normal, con una diferencia: cada color está amarrado
 * a una frase que el usuario tiene pendiente. Quitar piezas de un color
 * llena la barra de esa frase, y cuando se llena aparece la pregunta.
 *
 * Sin esa amarra sería un juego bonito que no enseña nada, y el tiempo
 * que pasa aquí sería tiempo robado a la sesión. Con ella, jugar
 * adelanta la cola de repaso igual que estudiar.
 *
 * Toda la lógica del tablero vive en domain/match3.ts y está probada
 * desde node. Aquí solo se pinta y se anima.
 */
export function DulcesScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const autoAudio = useSettingsStore((s) => s.autoAudio);
  const { nivel, config, filtrar } = useNivel('dulces', params?.nivel);
  const nv = config as NivelDulces | null;
  // Se necesita oír bien la voz del match y de la pregunta: la música
  // competiría justo en esos momentos.
  useMusicaPantalla('silencio');

  const COLS = nv?.cols ?? COLS_DEF;
  const ROWS = nv?.rows ?? ROWS_DEF;
  const COLORES = nv?.colores ?? COLORES_DEF;
  const FRASES = nv?.frases ?? COLORES_DEF;
  const META = nv?.metaPorFrase ?? META_DEF;
  const LADO = ladoPara(COLS);

  const [board, setBoard] = useState<Board | null>(null);
  const [pool, setPool] = useState<Entry[]>([]);
  const [objetivos, setObjetivos] = useState<DulceObjetivo[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);
  /** Sube uno en cada acierto: dispara las estrellas. */
  const [chispa, setChispa] = useState(0);
  // Cara y cubitos, ademas de las estrellas.
  const reaccion = useReaccion();
  const [jugadas, setJugadas] = useState(JUGADAS_DEF);
  const [resueltas, setResueltas] = useState(0);
  const [pregunta, setPregunta] = useState<{
    objetivo: DulceObjetivo;
    opciones: string[];
  } | null>(null);
  // Bloquea las opciones mientras suena la secuencia de la respuesta.
  const [respondiendo, setRespondiendo] = useState(false);
  const [elegidaOpcion, setElegidaOpcion] = useState<string | null>(null);
  const [avanzando, setAvanzando] = useState(false);

  const siguienteFrase = useRef(0);
  const empezoEn = useRef(Date.now());

  // Token de la secuencia de respuesta vigente: uno nuevo invalida
  // cualquier voz o temporizador en camino de una secuencia anterior
  // (Seguir, un timeout o una respuesta nueva no deberían poder
  // pisarse entre sí).
  const respuestaToken = useRef(0);
  const limiteRespuesta = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avanzarDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montado = useRef(true);

  // Throttle de la voz del match: entre toques muy seguidos, solo la
  // más reciente llega a sonar, y suena en cuanto pasa la ventana.
  const ultimaVozMatch = useRef(0);
  const vozMatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    montado.current = true;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') return;
      audio.stop();
      if (vozMatchTimer.current) clearTimeout(vozMatchTimer.current);
      if (limiteRespuesta.current) clearTimeout(limiteRespuesta.current);
    });
    return () => {
      montado.current = false;
      sub.remove();
      respuestaToken.current++;
      audio.stop();
      if (vozMatchTimer.current) clearTimeout(vozMatchTimer.current);
      if (limiteRespuesta.current) clearTimeout(limiteRespuesta.current);
      if (avanzarDebounce.current) clearTimeout(avanzarDebounce.current);
    };
  }, []);

  const carga = useCarga(
    async () => {
      if (!user || !nv) return;
      const entradas = await getRandomEntries(filter(), 120, {
        maxWords: 6,
        maxLen: 34,
      });

      const mezcladas = shuffle(filtrar(entradas, nv.frases));
      setPool(mezcladas);
      setObjetivos(
        mezcladas.slice(0, nv.frases).map((entry, i) => ({
          entry,
          // Con más frases que colores, dos frases comparten color: es
          // preferible a dejar colores muertos que no llenan nada.
          color: i % nv.colores,
          llevas: 0,
          meta: nv.metaPorFrase,
        }))
      );
      siguienteFrase.current = nv.frases;
      setJugadas(nv.jugadas);
      setBoard(createBoard(nv.cols, nv.rows, nv.colores));
      empezoEn.current = Date.now();
    },
    [user, filter, nv, filtrar]
  );
  const loading = carga.estado === 'cargando';

  const terminar = useCallback(() => {
    audio.stop();
    nav.replace('GameEnd', {
      juego: 'dulces',
      rondas: FRASES,
      aciertos: resueltas,
      nivel: nivel ?? undefined,
    });
  }, [nav, resueltas, FRASES, nivel]);

  /**
   * Voz del match: audio.play() ya invalida por su cuenta cualquier
   * reproducción anterior (su propio token), así que un match nuevo
   * nunca queda encimado con el de antes. El throttle es aparte: entre
   * toques muy seguidos evita una voz por cada uno, dejando sonar solo
   * la más reciente cuando pasa la ventana.
   */
  const reproducirVozMatch = useCallback(
    (entry: Entry) => {
      if (!autoAudio) return;
      if (vozMatchTimer.current) {
        clearTimeout(vozMatchTimer.current);
        vozMatchTimer.current = null;
      }
      const ahora = Date.now();
      const falta = VOZ_MATCH_THROTTLE_MS - (ahora - ultimaVozMatch.current);
      if (falta <= 0) {
        ultimaVozMatch.current = ahora;
        void audio.play(entry.audio_en);
      } else {
        vozMatchTimer.current = setTimeout(() => {
          ultimaVozMatch.current = Date.now();
          void audio.play(entry.audio_en);
        }, falta);
      }
    },
    [autoAudio]
  );

  const tocar = useCallback(
    (i: number) => {
      if (!board || pregunta || jugadas <= 0) return;

      if (elegida === null) {
        haptics.tapLight();
        void audio.playTap();
        setElegida(i);
        return;
      }
      if (elegida === i) {
        setElegida(null);
        return;
      }

      /*
       * Intercambio libre, y libre de verdad.
       *
       * Antes la ficha solo se movía si el movimiento armaba línea, y
       * solo entre vecinas. Eso convertía el juego en un buscaminas: la
       * app ya sabía la respuesta y solo te dejaba acertar.
       *
       * Ahora se puede cambiar CUALQUIER par de fichas, vecinas o no, y
       * el cambio se queda aunque no arme nada. Lo que hace que siga
       * siendo un juego y no un lienzo es el presupuesto de jugadas:
       * cada intercambio cuesta una, armes o no. Así el jugador decide
       * si explora o si va al grano, que es justo la decisión
       * interesante.
       */
      const nuevo = clone(board);
      swap(nuevo, elegida, i);

      const arma = findMatches(nuevo).length > 0;
      setElegida(null);
      setJugadas((j) => j - 1);

      if (!arma) {
        // El cambio se queda. Un golpecito seco: no pasó nada malo,
        // simplemente no armó.
        haptics.tapLight();
        void audio.playTap();
        setBoard(nuevo);
        return;
      }

      const res = resolve(nuevo, COLORES);

      haptics.success();
      void audio.playSuccess();
      // Relanza el estallido de estrellas. Cambiar el número es lo que
      // lo dispara; así no hace falta un temporizador para apagarlo.
      setChispa((c) => c + 1);
      reaccion.celebra();
      setBoard(nuevo);

      // Se reparte lo quitado entre las frases de cada color.
      setObjetivos((prev) => {
        const sig = prev.map((o) => ({
          ...o,
          llevas: o.llevas + (res.porColor[o.color] ?? 0),
        }));
        const llena = sig.find((o) => o.llevas >= o.meta);
        if (llena) {
          // Si esta jugada llena una barra, la voz del match se salta:
          // pasa directo a la pregunta.
          setPregunta({ objetivo: llena, opciones: opcionesPara(llena, pool) });
        } else {
          // El color con más piezas quitadas en esta jugada (una cascada
          // cuenta como una sola jugada, resolve() ya la resolvió
          // entera). En empate, el que esté más cerca de llenar su barra.
          const colorGanador = mejorColor(res.porColor, sig);
          const objetivo = sig.find((o) => o.color === colorGanador);
          if (objetivo) reproducirVozMatch(objetivo.entry);
        }
        return sig;
      });

      if (!hayMovimiento(nuevo)) {
        const rebarajado = clone(nuevo);
        rebarajar(rebarajado, COLORES);
        setBoard(rebarajado);
      }
    },
    [board, elegida, pregunta, jugadas, pool, COLORES, reproducirVozMatch]
  );

  // Al mostrarse la pregunta: corta lo que sonaba (incluida una voz de
  // match que hubiera quedado pendiente) y dice la frase en inglés.
  useEffect(() => {
    if (!pregunta) return;
    if (vozMatchTimer.current) {
      clearTimeout(vozMatchTimer.current);
      vozMatchTimer.current = null;
    }
    audio.stop();
    if (autoAudio) void audio.play(pregunta.objetivo.entry.audio_en);
    // Solo debe correr cuando aparece una pregunta nueva, no en cada
    // cambio de `respondiendo` mientras la misma sigue abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregunta]);

  /**
   * Cierra la pregunta vigente y continúa el juego: la frase resuelta
   * deja su color libre para la siguiente. La llaman tanto el final
   * natural de la voz como "Seguir" y el tope de RESPUESTA_MAXIMA_MS;
   * el token evita que dos de ellos avancen dos veces.
   */
  const avanzarTrasRespuesta = useCallback(
    (miToken: number, objetivo: DulceObjetivo) => {
      if (respuestaToken.current !== miToken) return;
      respuestaToken.current++;
      if (limiteRespuesta.current) clearTimeout(limiteRespuesta.current);
      audio.stop();
      if (!montado.current) return;

      // Sin módulo: antes daba la vuelta a la bolsa y repetía frases ya
      // contestadas en la misma partida. Si se acaban, el color se
      // queda con la que tenía y deja de pedir pregunta; la partida
      // termina por jugadas, como siempre.
      const nueva = pool[siguienteFrase.current];
      siguienteFrase.current++;

      setObjetivos((prev) =>
        prev
          .map((o) =>
            o.color === objetivo.color && nueva
              ? { entry: nueva, color: o.color, llevas: 0, meta: META }
              : o
          )
          .filter((o) => o.entry.id !== objetivo.entry.id || nueva)
      );
      setPregunta(null);
      setRespondiendo(false);
      setElegidaOpcion(null);
      empezoEn.current = Date.now();
    },
    [pool, META]
  );

  /**
   * ACIERTO: SFX de acierto, inglés, pausa breve, español.
   * FALLO: SFX de fallo, español de la correcta (para que se quede con
   * el significado). Sin "Voz automática" solo queda el SFX y un
   * momento visual para leer la marca, sin voces ni pausas largas.
   */
  const reproducirSecuenciaRespuesta = useCallback(
    async (objetivo: DulceObjetivo, bien: boolean) => {
      const miToken = ++respuestaToken.current;
      if (vozMatchTimer.current) {
        clearTimeout(vozMatchTimer.current);
        vozMatchTimer.current = null;
      }
      audio.stop();

      limiteRespuesta.current = setTimeout(
        () => avanzarTrasRespuesta(miToken, objetivo),
        RESPUESTA_MAXIMA_MS
      );

      void (bien ? audio.playSuccess() : audio.playFail());

      if (!autoAudio) {
        await new Promise((r) => setTimeout(r, SIN_VOZ_VISUAL_MS));
        avanzarTrasRespuesta(miToken, objetivo);
        return;
      }

      if (bien) {
        if (objetivo.entry.audio_en) {
          await audio.play(objetivo.entry.audio_en);
          await audio.waitUntilDone();
        }
        if (respuestaToken.current !== miToken) return; // Seguir/timeout ya cerró
        await new Promise((r) => setTimeout(r, PAUSA_ENTRE_IDIOMAS_MS));
        if (respuestaToken.current !== miToken) return;
        if (objetivo.entry.audio_es) {
          await audio.play(objetivo.entry.audio_es);
          await audio.waitUntilDone();
        }
      } else if (objetivo.entry.audio_es) {
        await audio.play(objetivo.entry.audio_es);
        await audio.waitUntilDone();
      }

      if (respuestaToken.current !== miToken) return;
      avanzarTrasRespuesta(miToken, objetivo);
    },
    [autoAudio, avanzarTrasRespuesta]
  );

  const responder = useCallback(
    (opcion: string) => {
      if (!pregunta || !user || respondiendo) return;
      const objetivo = pregunta.objetivo;
      const bien = opcion === objetivo.entry.spanish_main;

      setRespondiendo(true);
      setElegidaOpcion(opcion);

      void applyGameGrade(
        user.id,
        objetivo.entry.id,
        bien,
        Date.now() - empezoEn.current,
        'reconocer'
      );

      if (bien) {
        haptics.success();
        reaccion.celebra();
        setResueltas((r) => r + 1);
      } else {
        haptics.failure();
        reaccion.falla();
      }

      void reproducirSecuenciaRespuesta(objetivo, bien);
    },
    [pregunta, user, respondiendo, reaccion, reproducirSecuenciaRespuesta]
  );

  /** Botón "Seguir ›" de la pregunta: corta la voz y avanza ya. */
  const seguirAhora = useCallback(() => {
    if (avanzando || !pregunta) return;
    setAvanzando(true);
    if (avanzarDebounce.current) clearTimeout(avanzarDebounce.current);
    avanzarDebounce.current = setTimeout(
      () => setAvanzando(false),
      AVANZAR_DEBOUNCE_MS
    );
    avanzarTrasRespuesta(respuestaToken.current, pregunta.objetivo);
  }, [avanzando, pregunta, avanzarTrasRespuesta]);

  useEffect(() => {
    if (jugadas <= 0 && !pregunta) {
      const t = setTimeout(terminar, 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [jugadas, pregunta, terminar]);

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Dulces" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Dulces" />
        <View style={styles.center}>
          <Text style={styles.loading}>Llenando el tablero…</Text>
        </View>
      </Screen>
    );
  }

  if (!board || objetivos.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Dulces" />
        <EmptyState
          title="No se pudo armar el tablero"
          body="No hay frases suficientes con los filtros que traes puestos."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      padded={false}
      footer={
        // Fijo abajo solo mientras se juega el tablero: durante la
        // pregunta, "Dejarlo aquí" no aplica (esa tarjeta ya tiene su
        // propia acción con "Seguir").
        !pregunta ? (
          <Button label="Dejarlo aquí" variant="ghost" onPress={terminar} full />
        ) : undefined
      }
    >
      <Estrellas disparo={chispa} />
      <Trozos disparo={reaccion.trozos} tinte={color.world.cultura} />
      <View style={styles.top}>
        <Header
          onBack={() => nav.goBack()}
          title={nivel ? `Nivel ${nivel}` : undefined}
          right={
            <Text style={styles.jugadas}>
              {jugadas} {jugadas === 1 ? 'jugada' : 'jugadas'}
            </Text>
          }
        />
      </View>

      {pregunta ? (
        <Animated.View entering={FadeIn.duration(240)} style={styles.preguntaWrap}>
          <Card style={styles.preguntaCard} accent={TINTES[pregunta.objetivo.color]}>
            <Text style={styles.preguntaEtiqueta}>Llenaste esta</Text>
            <Text style={styles.preguntaFrase}>
              {pregunta.objetivo.entry.phrase}
            </Text>
            <Text style={styles.preguntaAyuda}>¿Qué significa?</Text>
            {pregunta.opciones.map((o) => {
              const esCorrecta = o === pregunta.objetivo.entry.spanish_main;
              const marcar = respondiendo && (esCorrecta || o === elegidaOpcion);
              return (
                <Pressable
                  key={o}
                  onPress={() => responder(o)}
                  disabled={respondiendo}
                  accessibilityRole="button"
                  accessibilityLabel={o}
                  style={({ pressed }) => [
                    styles.opcion,
                    pressed && !respondiendo && styles.opcionPress,
                    marcar && esCorrecta && styles.opcionCorrecta,
                    marcar && !esCorrecta && styles.opcionFallada,
                  ]}
                >
                  <Text style={styles.opcionTexto}>{o}</Text>
                </Pressable>
              );
            })}

            {respondiendo ? (
              <Pressable
                onPress={seguirAhora}
                disabled={avanzando}
                accessibilityRole="button"
                accessibilityLabel="Siguiente"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.seguir,
                  pressed && !avanzando && styles.seguirPress,
                ]}
              >
                <Text style={styles.seguirTexto}>Siguiente</Text>
                <Icon name="chevron-right" size="sm" color={color.textFaint} />
              </Pressable>
            ) : (
              <AudioButton
                path={pregunta.objetivo.entry.audio_en}
                size="sm"
                label="Escuchar"
              />
            )}
          </Card>
        </Animated.View>
      ) : (
        // Scroll interno: en niveles con más filas/columnas el tablero
        // puede pasar de la altura disponible en pantallas chicas, y sin
        // esto "Dejarlo aquí" (ahora fijo en el footer) quedaba bien,
        // pero el tablero se cortaba contra él en vez de dejarse ver
        // completo con scroll.
        <ScrollView
          style={styles.medio}
          contentContainerStyle={styles.medioContenido}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.metas}>
            {objetivos.map((o) => (
              <View key={o.color} style={styles.meta}>
                {/* El punto usa el MISMO tinte que las fichas de ese
                    color en el tablero. Si no coinciden, el usuario no
                    puede saber qué barra está llenando. */}
                <View
                  style={[styles.punto, { backgroundColor: TINTES[o.color] }]}
                />
                <View style={styles.metaCuerpo}>
                  <Text style={styles.metaFrase} numberOfLines={2}>
                    {o.entry.phrase}
                  </Text>
                  <ProgressBar
                    value={Math.min(o.llevas, o.meta)}
                    total={o.meta}
                    tint={TINTES[o.color]}
                    height={4}
                  />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.tablero}>
            {board.cells.map((c, i) => (
              <AnimatedPressable
                // La clave incluye el color: cuando una pieza cambia de
                // color tras una cascada, React la trata como pieza
                // nueva y reanimated le corre la entrada. Sin eso el
                // tablero se recolorea de golpe y no se ve caer nada.
                key={`c-${i}-${c}`}
                entering={ZoomIn.duration(220).delay((i % COLS) * 18)}
                layout={LinearTransition.duration(180)}
                onPress={() => tocar(i)}
                accessibilityRole="button"
                accessibilityLabel="Pieza"
                style={[
                  styles.pieza,
                  { width: LADO, height: LADO },
                  { backgroundColor: TINTES[c] ?? color.surfaceHigh },
                  elegida === i && styles.piezaElegida,
                ]}
              />
            ))}
          </View>

          <Text style={styles.pieNota}>
            {resueltas > 0
              ? `${resueltas} ${resueltas === 1 ? 'frase resuelta' : 'frases resueltas'}`
              : 'Junta tres del mismo color para llenar su barra'}
          </Text>
        </ScrollView>
      )}
    </Screen>
  );
}

/**
 * Tres opciones: la correcta y dos de otras frases del mismo montón.
 * Cuatro no caben junto al tablero sin hacer scroll, y hacer scroll en
 * medio de una pregunta rompe el ritmo del juego.
 */
function opcionesPara(o: DulceObjetivo, pool: Entry[]): string[] {
  const correcta = o.entry.spanish_main;
  const otras = shuffle(
    pool
      .filter((e) => e.id !== o.entry.id && e.spanish_main !== correcta)
      .map((e) => e.spanish_main)
  ).slice(0, 2);
  return shuffle([correcta, ...otras]);
}

/**
 * De los colores quitados en la jugada, cuál se lleva la voz del
 * match: el de más piezas y, en empate, el más cerca de llenar su
 * barra (ya con lo de esta jugada sumado).
 */
function mejorColor(
  porColor: Record<number, number>,
  objetivos: DulceObjetivo[]
): number | null {
  let mejor: number | null = null;
  let mejorPiezas = -1;
  let mejorCercania = -1;

  for (const [colStr, piezas] of Object.entries(porColor)) {
    const col = Number(colStr);
    const o = objetivos.find((x) => x.color === col);
    const cercania = o ? o.llevas / o.meta : 0;
    if (piezas > mejorPiezas || (piezas === mejorPiezas && cercania > mejorCercania)) {
      mejor = col;
      mejorPiezas = piezas;
      mejorCercania = cercania;
    }
  }
  return mejor;
}

const TINTES: string[] = [
  color.world.calle,
  color.world.dia_a_dia,
  color.world.dinero,
  color.world.cultura,
  color.world.fonetica,
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  jugadas: {
    fontSize: font.size.sm,
    fontFamily: font.family.bodyStrong,
    color: color.accent,
  },
  medio: { flex: 1 },
  medioContenido: { paddingBottom: space.sm },
  metas: { paddingHorizontal: space.lg, gap: 6, marginBottom: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  punto: { width: 12, height: 12, borderRadius: 6 },
  metaCuerpo: { flex: 1, gap: 2 },
  metaFrase: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted },
  tablero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  pieza: {
    borderRadius: radius.sm,
    borderBottomWidth: depth.md,
    // Sobre tinta el canto se hunde con negro, no con tinta translucida:
    // un 12% de tinta sobre un fondo ya oscuro no se ve.
    borderBottomColor: color.biselSombra,
    ...shadow.soft,
  },
  piezaElegida: {
    borderWidth: 3,
    borderColor: color.text,
    borderBottomWidth: 3,
  },
  pieNota: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.md,
  },
  preguntaWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: space.lg },
  preguntaCard: { gap: space.sm },
  preguntaEtiqueta: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontFamily: font.family.bodyStrong,
  },
  preguntaFrase: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
  },
  preguntaAyuda: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  opcion: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
    borderBottomWidth: depth.md,
    borderBottomColor: color.borderStrong,
  },
  opcionPress: { opacity: 0.75 },
  opcionCorrecta: {
    borderColor: color.correct,
    backgroundColor: color.correctSoft,
  },
  opcionFallada: {
    borderColor: color.wrong,
    backgroundColor: color.wrongSoft,
  },
  opcionTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  seguir: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'center', marginTop: space.sm, padding: space.sm },
  seguirPress: { opacity: 0.6 },
  seguirTexto: {
    fontSize: font.size.sm,
    color: color.textFaint,
    fontFamily: font.family.bodyStrong,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
});
