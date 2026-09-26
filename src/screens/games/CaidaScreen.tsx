import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/components/base';
import { Marcador } from '@/components/fx';
import { Trozos, useReaccion } from '@/components/feedback';
import { FichaCaida, type EstadoFicha } from '@/components/juegos/caida/FichaCaida';
import { FinCaida, PieFinCaida } from '@/components/juegos/caida/FinCaida';
import { FraseRonda } from '@/components/juegos/caida/FraseRonda';
import { HojaPausa } from '@/components/juegos/caida/HojaPausa';
import { IndicadorRitmo } from '@/components/juegos/caida/IndicadorRitmo';
import { PistaCaida } from '@/components/juegos/caida/PistaCaida';
import { MARGEN_ARRIBA, chevronsPara, largoEstela } from '@/components/juegos/caida/medidas';
import { CAIDA_INICIAL_MS, CAIDA_MINIMA_MS, buildRounds } from '@/domain/caida';
import { useNivel } from './useNivel';
import { applyGameGrade } from '@/db/games';
import { getNiveles } from '@/db/levels';
import { getRandomEntries } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import {
  color,
  font,
  motionDuration,
  motionEasing,
  motionLogro,
  motionSpring,
  radius,
  shadow,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/utils';
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
/** Respiro tras la voz antes de seguir a la ronda siguiente. */
const RESPIRO_MS = 300;
/** Respiro tras la voz de una ronda perdida, antes de la pantalla final. */
const RESPIRO_PERDIDA_MS = 500;
/** Cuánto se aplastan las fichas al chocar con el piso (scaleY): vuelven a 1 con rebote. */
const APLASTE = 0.92;
/** Tope del vuelo de la ficha acertada hasta el marcador (unos 470 ms): pasado esto el marcador se actualiza igual. */
const VUELO_MAXIMO_MS = 1200;
/** Bloqueo de "Siguiente" en la pausa contra doble toque. */
const AVANZAR_DEBOUNCE_MS = 400;

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
  // Cómo terminó la ronda perdida: ficha equivocada o fichas contra el piso. Mientras se ve ese final
  // (`animandoFin`) la hoja de la pausa espera.
  const [finRonda, setFinRonda] = useState<'fallo' | 'piso' | null>(null);
  const [animandoFin, setAnimandoFin] = useState(false);
  // Ronda y texto de la ficha acertada: la ronda evita que un texto repetido marque la siguiente.
  const [acertada, setAcertada] = useState<string | null>(null);
  // Pausa al acertar: congela la caída y bloquea las fichas mientras se
  // oye la frase en inglés y su traducción.
  const [enPausa, setEnPausa] = useState(false);
  const [pausaInfo, setPausaInfo] = useState<{ entry: Entry; correct: boolean } | null>(
    null
  );
  const [avanzando, setAvanzando] = useState(false);
  // La ficha acertada vuela al marcador: mientras tanto el marcador muestra el número de antes y la
  // pausa espera. `destino` es el centro del marcador en el espacio de la pista.
  const [volando, setVolando] = useState(false);
  const [destino, setDestino] = useState<{ x: number; y: number } | null>(null);
  const capaRef = useRef<View>(null);
  const pistaRef = useRef<View>(null);
  const marcadorRef = useRef<View>(null);

  const y = useSharedValue(0);
  const pulsoMarcador = useSharedValue(0);
  // El choque contra el piso: el aplastamiento de las fichas y el destello del piso.
  const aplasta = useSharedValue(1);
  const golpe = useSharedValue(0);
  // La estela de las fichas: 1 mientras caen, 0 al contestar o al llegar al piso.
  const estela = useSharedValue(0);
  // Cuánto baja la fila hasta tocar el piso, según el alto real de la
  // pista, medido en pantalla: depende del encabezado, de la frase (que a
  // veces son dos renglones) y de la barra de gestos del teléfono.
  const [altoPista, setAltoPista] = useState(0);
  const empezoEn = useRef(Date.now());
  const round = rounds[idx];

  // `aciertos` en un ref: al ir a GameEnd tras la pausa, el closure del
  // momento en que se acertó ya puede estar viejo. El ref siempre trae
  // el valor real.
  const aciertosRef = useRef(0);
  // El récord del nivel: el que ya estaba en `nivel_juego` y el mejor de esta sesión (la base solo se
  // actualiza al pasar por «Ver cómo me fue»). `recordAntes` es lo que había que superar en la partida que
  // acaba de terminar.
  const mejorGuardado = useRef(0);
  const mejorSesion = useRef(0);
  const [recordAntes, setRecordAntes] = useState(0);
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
    if (!user || !nivel) return undefined;
    let vivo = true;
    getNiveles(user.id, 'caida')
      .then((estados) => {
        if (vivo) mejorGuardado.current = estados.get(nivel)?.mejor ?? 0;
      })
      .catch((err: unknown) => {
        // Sin el récord la pantalla final solo no lo muestra: la partida no depende de él.
        if (__DEV__) console.warn('[caida] no se pudo leer el récord del nivel', err);
      });
    return () => {
      vivo = false;
    };
  }, [user, nivel]);

  /** Se acabó la partida: se guarda contra qué récord se jugó y pasa la pantalla final. */
  const terminarPartida = useCallback(() => {
    setRecordAntes(Math.max(mejorGuardado.current, mejorSesion.current));
    mejorSesion.current = Math.max(mejorSesion.current, aciertosRef.current);
    setPerdio(true);
  }, []);

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
    setVolando(false);
    setFinRonda(null);
    setAnimandoFin(false);
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
      setPausaInfo({ entry, correct });
      setEnPausa(true);

      limiteTimer.current = setTimeout(
        () => avanzarTrasPausa(miToken),
        PAUSA_MAXIMA_MS
      );

      await audio.playRoundResultBilingue(correct, entry.audio_en, entry.audio_es);
      if (pausaToken.current !== miToken) return; // ya lo cerró otra vía

      await new Promise((r) => setTimeout(r, correct ? RESPIRO_MS : RESPIRO_PERDIDA_MS));
      avanzarTrasPausa(miToken);
    },
    [avanzarTrasPausa]
  );

  /** El centro del marcador respecto de la pista: a donde vuela la ficha acertada. Se mide contra la capa común. */
  const medirDestino = useCallback(() => {
    const capa = capaRef.current;
    const marcador = marcadorRef.current;
    const pista = pistaRef.current;
    if (!capa || !marcador || !pista) return;
    marcador.measureLayout(
      capa,
      (mx, my, mw, mh) =>
        pista.measureLayout(
          capa,
          (px, py) =>
            setDestino((d) => {
              const x = mx + mw / 2 - px;
              const yc = my + mh / 2 - py;
              return d && d.x === x && d.y === yc ? d : { x, y: yc };
            }),
          () => undefined
        ),
      () => undefined
    );
  }, []);

  /** La ficha acertada llegó: el marcador rueda al número nuevo y pulsa 1 → 1.06 → 1. */
  const alLlegarFicha = useCallback(() => {
    setVolando(false);
    if (reducido) return;
    pulsoMarcador.value = withSequence(
      withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
    );
  }, [reducido, pulsoMarcador]);

  // Si la ficha no avisa que llegó (app en segundo plano a mitad del vuelo), el marcador se actualiza igual.
  useEffect(() => {
    if (!volando) return undefined;
    const t = setTimeout(() => setVolando(false), VUELO_MAXIMO_MS);
    return () => clearTimeout(t);
  }, [volando]);

  useEffect(() => {
    medirDestino();
  }, [medirDestino, altoPista]);

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
    setFinRonda('piso');
    setAnimandoFin(!reducido);
    haptics.failure();
    estela.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });
    void pausarConVoz(round.entry, false, terminarPartida);
  }, [round, enPausa, pausarConVoz, terminarPartida, estela, reducido]);

  // Arranca la caída de cada ronda.
  useEffect(() => {
    if (!round || perdio || enPausa) return;

    empezoEn.current = Date.now();
    y.value = 0;
    estela.value = 0;
    if (altoPista <= 0) return;

    estela.value = withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar });
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
  }, [round, perdio, enPausa, y, estela, autoAudio, seCayo, altoPista]);

  // Fin de una ronda perdida. Ficha equivocada: primero se ve el veredicto (`lento`) y luego las dos caen
  // suavemente al piso. Piso: las fichas ya llegaron y se aplastan un poco con rebote mientras el piso
  // destella. Va después del arranque de la caída para correr tras su limpieza, que cancela `y`. Con
  // «reducir movimiento» solo cambian los colores.
  useEffect(() => {
    if (!finRonda || reducido) return undefined;
    let duracion = motionDuration.lento;
    if (finRonda === 'fallo') {
      y.value = withDelay(
        motionDuration.lento,
        withTiming(altoPista, { duration: motionDuration.escena, easing: motionEasing.salir })
      );
      duracion += motionDuration.escena;
    } else {
      aplasta.value = APLASTE;
      aplasta.value = withSpring(1, motionSpring.rebote);
      golpe.value = withSequence(
        withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
      );
    }
    const t = setTimeout(() => setAnimandoFin(false), duracion);
    return () => clearTimeout(t);
  }, [finRonda, reducido, altoPista, y, aplasta, golpe]);

  // Con «reducir movimiento» las fichas no caen: se quedan arriba y una barra cuenta el tiempo.
  const anim = useAnimatedStyle(() => ({
    transform: reducido ? [] : [{ translateY: y.value }, { scaleY: aplasta.value }],
  }));

  // 1 → `motionLogro.escala` → 1: la misma escala con la que pulsa un logro en Niveles.
  const pulsoAnim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (motionLogro.escala - 1) * pulsoMarcador.value }],
  }));

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
      estela.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });

      const bien = texto === round.correcta;
      const ms = Date.now() - empezoEn.current;

      if (user) {
        void applyGameGrade(user.id, round.entry.id, bien, ms, 'reconocer');
      }

      if (!bien) {
        haptics.failure();
        setFallada(texto);
        setFinRonda('fallo');
        setAnimandoFin(!reducido);
        void pausarConVoz(round.entry, false, terminarPartida);
        return;
      }

      setAcertada(`${idx}|${texto}`);
      setVolando(true);
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
    [round, perdio, enPausa, y, estela, user, idx, rounds.length, nav, nivel, pausarConVoz, terminarPartida]
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
          // Fijo abajo: una frase larga en la tarjeta (o un "Elegiste: ..." largo) no debe poder empujar
          // estos dos botones fuera de la pantalla en un equipo chico.
          <PieFinCaida
            onOtraVez={() => {
              // El contador de aciertos vive también en un ref (la pausa lo lee sin esperar al render):
              // empezar de nuevo lo reinicia igual que el estado.
              aciertosRef.current = 0;
              setIdx(0);
              setAciertos(0);
              setFallada(null);
              setAcertada(null);
              setFinRonda(null);
              setAnimandoFin(false);
              setPerdio(false);
            }}
            onVerResultado={() =>
              nav.replace('GameEnd', {
                juego: 'caida',
                rondas: rounds.length,
                aciertos,
                nivel: nivel ?? undefined,
              })
            }
          />
        }
      >
        <Header onBack={() => nav.goBack()} title={nivel ? `Nivel ${nivel}` : undefined} />
        {round ? (
          <FinCaida aciertos={aciertos} entry={round.entry} correcta={round.correcta} fallada={fallada} record={recordAntes} />
        ) : null}
      </Screen>
    );
  }

  if (!round) return null;

  const izquierda = round.correctaIzquierda ? round.correcta : round.falsa;
  const derecha = round.correctaIzquierda ? round.falsa : round.correcta;
  // El ritmo es el del nivel: cada uno trae su duración inicial y su mínima. Las constantes son el respaldo.
  const chevrons = chevronsPara(
    round.duracionMs,
    nv?.caidaInicialMs ?? CAIDA_INICIAL_MS,
    nv?.caidaMinimaMs ?? CAIDA_MINIMA_MS
  );

  return (
    <Screen padded={false} style={styles.sinHueco}>
      <View ref={capaRef} style={styles.capa}>
        <Trozos disparo={reaccion.trozos} tinte={color.correct} x="50%" y="62%" />
        <View style={styles.top}>
          <Header
            onBack={() => nav.goBack()}
            title={nivel ? `Nivel ${nivel}` : undefined}
            right={
              <View style={styles.derecha}>
                <IndicadorRitmo nivel={chevrons} />
                <View ref={marcadorRef} collapsable={false} onLayout={medirDestino}>
                  <Animated.View style={pulsoAnim}>
                    <Marcador
                      valor={aciertos - (volando ? 1 : 0)}
                      tamano={font.size.xl}
                      color={color.accent}
                      etiqueta={`${aciertos} ${aciertos === 1 ? 'acierto' : 'aciertos'}`}
                    />
                  </Animated.View>
                </View>
              </View>
            }
          />
          <FraseRonda key={idx} texto={round.entry.phrase} />
          <Text style={styles.instruccion}>
            Toca el significado antes de que lleguen abajo
          </Text>
        </View>

        <PistaCaida
          pistaRef={pistaRef}
          y={y}
          onDistancia={setAltoPista}
          largoEstela={largoEstela(altoPista, round.duracionMs)}
          estela={estela}
          armado={!enPausa}
          golpe={golpe}
        >
          <Animated.View style={[styles.fila, anim]}>
            <FichaCaida
              key={`${idx}-a`}
              texto={izquierda}
              estado={estadoFicha(izquierda, round.correcta, fallada, acertada, idx)}
              y={y}
              destino={destino}
              onLlego={alLlegarFicha}
              onPress={() => void responder(izquierda)}
            />
            <FichaCaida
              key={`${idx}-b`}
              texto={derecha}
              estado={estadoFicha(derecha, round.correcta, fallada, acertada, idx)}
              y={y}
              destino={destino}
              onLlego={alLlegarFicha}
              onPress={() => void responder(derecha)}
            />
          </Animated.View>
        </PistaCaida>

        <HojaPausa
          entry={pausaInfo?.entry ?? null}
          correct={pausaInfo?.correct ?? false}
          visible={enPausa && !volando && !animandoFin}
          avanzando={avanzando}
          onContinuar={tocarSiguienteEnPausa}
        />
      </View>
    </Screen>
  );
}

/**
 * Qué le pasó a una ficha esta ronda: la acertada, la equivocada (`fallada`), la que era tras un fallo
 * (`correcta`) o la que sobra tras un acierto.
 */
function estadoFicha(
  texto: string,
  correcta: string,
  fallada: string | null,
  acertada: string | null,
  ronda: number
): EstadoFicha {
  if (fallada === texto) return 'fallo';
  if (fallada !== null && texto === correcta) return 'correcta';
  if (acertada === `${ronda}|${texto}`) return 'acierto';
  return acertada?.startsWith(`${ronda}|`) ? 'descartada' : 'normal';
}

const styles = StyleSheet.create({
  // `Screen` suma un colchón abajo cuando no hay footer: aquí el contenido llega hasta el borde seguro.
  sinHueco: { paddingBottom: 0 },
  capa: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  derecha: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  instruccion: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.xs,
  },
  // La fila va absoluta arriba de la pista y baja con `translateY`: el piso es de la pista, no de esta fila.
  fila: {
    position: 'absolute',
    // El aplastamiento contra el piso (`scaleY`) sale de abajo, donde las fichas tocan.
    transformOrigin: 'bottom',
    top: MARGEN_ARRIBA,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
});
