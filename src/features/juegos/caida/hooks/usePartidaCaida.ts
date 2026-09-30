import { useCallback, useEffect, useReducer, useRef, useState, useLayoutEffect } from 'react';
import { AppState } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { Easing, cancelAnimation, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { PARTIDA_INICIAL, fasePartida, partidaCaida } from '@/features/juegos/caida/logic/partida';
import { useChoqueCaida } from './useChoqueCaida';
import { useMarcadorCaida } from './useMarcadorCaida';
import { usePausaCaida } from './usePausaCaida';
import { buildRounds } from '@/domain/caida';
import { useNivel } from '@/features/juegos/comun/useNivel';
import { applyGameGrade } from '@/data/repos/juegos';
import { getNiveles } from '@/data/repos/niveles';
import { getRandomEntries } from '@/data/repos/frases';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { useReaccion } from '@/shared/hooks/useReaccion';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { motionDuration, motionEasing } from '@/theme';
import type { CaidaRound, NivelCaida } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Caida'>;

/**
 * Respaldo de la caída: si el aviso de fin de la animación no llega
 * (cancelada, app en segundo plano, un cuadro perdido), este temporizador
 * cierra la ronda igual este rato después de lo que debía durar.
 */
const RESPALDO_CAIDA_MS = 300;

/**
 * Toda la partida de Caída: rondas, caída, respuesta, pausa de fin de ronda y la pantalla final. La pantalla
 * solo la pinta. El momento de la partida vive en una máquina de estados (`logic/partida.ts`).
 *
 * La animación corre en el hilo de UI con reanimated. Con un
 * setInterval en JS la caída se traba justo cuando SQLite escribe la
 * respuesta anterior, que es exactamente el peor momento.
 */
export function usePartidaCaida() {
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
  useCortarAudioAlSalir();

  const [rounds, setRounds] = useState<CaidaRound[]>([]);
  // Cara y cubitos. El numero se relanza en cada respuesta;
  // no hace falta apagarlo con un temporizador.
  const reaccion = useReaccion();
  // La versión más reciente de retomarCaida (definida más abajo), para quien la llama desde un temporizador.
  const retomarRef = useRef<() => void>(() => undefined);
  const { celebra } = reaccion;
  const [idx, setIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  // cayendo, pausa o perdida: la pausa congela la caída y bloquea las fichas mientras se oye la frase.
  const [partida, despachar] = useReducer(partidaCaida, PARTIDA_INICIAL);
  const perdio = partida.fase === 'perdida';
  const enPausa = partida.fase === 'pausa';
  const pausaInfo = partida.fase === 'pausa' ? { entry: partida.entry, correct: partida.correct } : null;
  const [fallada, setFallada] = useState<string | null>(null);
  // Cómo terminó la ronda perdida: ficha equivocada o fichas contra el piso. Mientras se ve ese final
  // (`animandoFin`) la hoja de la pausa espera.
  const [finRonda, setFinRonda] = useState<'fallo' | 'piso' | null>(null);
  const [animandoFin, setAnimandoFin] = useState(false);
  // Ronda y texto de la ficha acertada: la ronda evita que un texto repetido marque la siguiente.
  const [acertada, setAcertada] = useState<string | null>(null);
  // Qué ronda ya terminó (contestada o contra el piso): la animación y su
  // respaldo no pueden cerrarla dos veces, ni después de una respuesta.
  const cerradaEn = useRef(-1);
  // La caída en curso: cuándo llega al piso y su temporizador de respaldo.
  // Al ir a segundo plano se guarda cuánto le faltaba para retomarla.
  const caidaFin = useRef(0);
  const respaldoCaida = useRef<ReturnType<typeof setTimeout> | null>(null);
  const caidaRestante = useRef<number | null>(null);
  // La ficha acertada vuela al marcador (ver useMarcadorCaida): mientras tanto la pausa espera.
  const [volando, setVolando] = useState(false);

  const y = useSharedValue(0);
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
  const montado = useRef(true);

  const alSoltarPausa = () => {
    setVolando(false);
    setFinRonda(null);
    setAnimandoFin(false);
  };
  const pausa = usePausaCaida(despachar, montado, alSoltarPausa);
  const { pausarConVoz, invalidarPausa, limpiarTemporizadores } = pausa;

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
    despachar({ tipo: 'perder' });
  }, []);

  useEffect(() => {
    montado.current = true;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') {
        // De vuelta: la caída sigue desde donde se quedó, con lo que le
        // faltaba (ver retomarCaida).
        retomarRef.current();
        return;
      }
      // En segundo plano no se avanza de ronda: se corta la voz y la caída
      // se congela donde está. El tope de la pausa NO se quita: si la voz
      // no vuelve, al regresar la pausa se suelta igual.
      audio.stop();
      if (respaldoCaida.current) {
        clearTimeout(respaldoCaida.current);
        respaldoCaida.current = null;
        caidaRestante.current = Math.max(0, caidaFin.current - Date.now());
      }
      cancelAnimation(y);
    });
    return () => {
      montado.current = false;
      sub.remove();
      invalidarPausa();
      audio.stop();
      limpiarTemporizadores();
      if (respaldoCaida.current) clearTimeout(respaldoCaida.current);
      cancelAnimation(y);
    };
  }, [y, invalidarPausa, limpiarTemporizadores]);

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
  const marcador = useMarcadorCaida(volando, setVolando, altoPista, reducido);

  /**
   * Se acabó el tiempo: las tarjetas tocaron el piso.
   *
   * No puede disparar esto durante la pausa de un acierto: la animación
   * ya está cancelada en ese momento (cancelAnimation en responder), así
   * que este callback nunca llega a correr con `terminada: true`. La
   * bandera es un cinturón extra por si algún callback viejo se cuela.
   */
  const seCayo = useCallback(() => {
    if (enPausa || !round || cerradaEn.current === idx) return;
    cerradaEn.current = idx;
    if (respaldoCaida.current) clearTimeout(respaldoCaida.current);
    respaldoCaida.current = null;
    caidaRestante.current = null;
    setFallada(null);
    setAcertada(null);
    setFinRonda('piso');
    setAnimandoFin(!reducido);
    haptics.failure();
    estela.set(withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }));
    void pausarConVoz(round.entry, false, terminarPartida);
  }, [round, idx, enPausa, pausarConVoz, terminarPartida, estela, reducido]);

  // El aviso de fin de la caída llega desde el hilo de UI: siempre corre la versión vigente de seCayo.
  const seCayoRef = useRef(seCayo);
  useLayoutEffect(() => {
    seCayoRef.current = seCayo;
  }, [seCayo]);
  const alLlegarAlPiso = useCallback(() => seCayoRef.current(), []);

  /**
   * Lanza la caída hasta el piso en `duracionMs`. La ronda la cierra el
   * aviso de fin de la animación o, si ese no llega, el respaldo; nunca
   * los dos (cerradaEn).
   */
  const lanzarCaida = useCallback(
    (duracionMs: number) => {
      if (respaldoCaida.current) clearTimeout(respaldoCaida.current);
      caidaRestante.current = null;
      caidaFin.current = Date.now() + duracionMs;
      y.set(withTiming(altoPista, { duration: duracionMs, easing: Easing.linear }, (terminada) => {
        if (terminada) runOnJS(alLlegarAlPiso)();
      }));
      respaldoCaida.current = setTimeout(alLlegarAlPiso, duracionMs + RESPALDO_CAIDA_MS);
    },
    [y, altoPista, alLlegarAlPiso]
  );

  /** Al volver de segundo plano: la caída que se congeló sigue con lo que le faltaba. */
  const retomarCaida = useCallback(() => {
    const restante = caidaRestante.current;
    if (restante === null || !round || perdio || enPausa || cerradaEn.current === idx) return;
    if (restante <= 0) {
      seCayoRef.current();
      return;
    }
    lanzarCaida(restante);
  }, [round, perdio, enPausa, idx, lanzarCaida]);
  useLayoutEffect(() => {
    retomarRef.current = retomarCaida;
  }, [retomarCaida]);

  // Arranca la caída de cada ronda.
  useEffect(() => {
    if (!round || perdio || enPausa) return;

    empezoEn.current = Date.now();
    y.set(0);
    estela.set(0);
    if (altoPista <= 0) return;

    estela.set(withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }));
    lanzarCaida(round.duracionMs);

    // Aviso corto de que algo empieza a caer, antes de la frase.
    void audio.playCaidaPieza();
    if (autoAudio) void audio.play(round.entry.audio_en);

    return () => {
      cancelAnimation(y);
      if (respaldoCaida.current) clearTimeout(respaldoCaida.current);
      respaldoCaida.current = null;
    };
  }, [round, perdio, enPausa, y, estela, autoAudio, lanzarCaida, altoPista]);

  const choque = useChoqueCaida(finRonda, reducido, altoPista, y, setAnimandoFin);

  const responder = (texto: string) => {
    if (!round || perdio || enPausa || cerradaEn.current === idx) return;
    cerradaEn.current = idx;
    cancelAnimation(y);
    if (respaldoCaida.current) clearTimeout(respaldoCaida.current);
    respaldoCaida.current = null;
    caidaRestante.current = null;
    estela.set(withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }));

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
    celebra();
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
  };

  /** «Otra vez» en la pantalla final: la misma partida desde la ronda 0. */
  const otraVez = () => {
    // El contador de aciertos vive también en un ref (la pausa lo lee sin esperar al render):
    // empezar de nuevo lo reinicia igual que el estado.
    aciertosRef.current = 0;
    // La ronda 0 vuelve a empezar: su bandera de "ya terminó" también.
    cerradaEn.current = -1;
    caidaRestante.current = null;
    setIdx(0);
    setAciertos(0);
    setFallada(null);
    setAcertada(null);
    setFinRonda(null);
    setAnimandoFin(false);
    despachar({ tipo: 'otraVez' });
  };

  return {
    nav,
    carga,
    loading,
    fase: fasePartida(partida, loading),
    nivel,
    nv,
    rounds,
    round,
    idx,
    aciertos,
    perdio,
    enPausa,
    pausaInfo,
    fallada,
    acertada,
    animandoFin,
    volando,
    destino: marcador.destino,
    recordAntes,
    avanzando: pausa.avanzando,
    reaccion,
    capaRef: marcador.capaRef,
    pistaRef: marcador.pistaRef,
    marcadorRef: marcador.marcadorRef,
    y,
    golpe: choque.golpe,
    estela,
    altoPista,
    anim: choque.anim,
    pulsoAnim: marcador.pulsoAnim,
    setAltoPista,
    medirDestino: marcador.medirDestino,
    alLlegarFicha: marcador.alLlegarFicha,
    responder,
    otraVez,
    tocarSiguienteEnPausa: pausa.tocarSiguienteEnPausa,
  };
}
