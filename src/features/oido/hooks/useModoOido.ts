import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { useAnimatedStyle } from 'react-native-reanimated';
import { useBolsillo } from '@/features/oido/hooks/useBolsillo';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { getRandomEntries } from '@/data/repos/frases';
import { analizar } from '@/domain/marcas';
import { useCarga } from '@/shared/hooks/useCarga';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import { marcasDe } from '@/services/marcas';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

const PAUSA_ENTRE_IDIOMAS_MS = 800;

// Pausa al FINAL de cada ronda (1, 2 y 3). La última es más larga: da
// tiempo a leer la frase que sigue antes de que empiece a sonar.
const PAUSA_RONDA_MS: readonly [number, number, number] = [1500, 1500, 2500];

/**
 * Arma los pasos de una frase: inglés, pausa corta, español, pausa de
 * ronda — tres veces. Sin español, solo suena el inglés las tres
 * veces (nunca se salta la frase por eso).
 */
function pasosFrase(
  audioEn: string,
  audioEs: string | null
): { path: string | null; pauseMs: number }[] {
  const pasos: { path: string | null; pauseMs: number }[] = [];
  for (let ronda = 0; ronda < 3; ronda++) {
    const pausaRonda = PAUSA_RONDA_MS[ronda]!;
    if (audioEs) {
      pasos.push({ path: audioEn, pauseMs: PAUSA_ENTRE_IDIOMAS_MS });
      pasos.push({ path: audioEs, pauseMs: pausaRonda });
    } else {
      pasos.push({ path: audioEn, pauseMs: pausaRonda });
    }
  }
  return pasos;
}

/**
 * Modo oído: la cola de frases, la secuencia de repeticiones y el bolsillo.
 */
export function useModoOido() {
  useKeepAwake();
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const { height: altoVentana } = useWindowDimensions();
  useMusicaPantalla('silencio');

  const [queue, setQueue] = useState<Entry[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Ya se le dio a «Empezar» alguna vez: antes de eso el botón no puede decir «Reanudar».
  const [empezo, setEmpezo] = useState(false);
  // Paso (0-based) dentro de pasosFrase() de la frase actual. Sirve
  // para mostrar "Repetición X/3" y para que "reanudar" retome ESE
  // paso en vez de reiniciar la frase desde la ronda 1.
  const [pasoIdx, setPasoIdx] = useState(0);

  // Refs además del state: el bucle asíncrono no ve el state nuevo.
  const playingRef = useRef(false);
  const pasoIdxRef = useRef(0);
  const idxRef = useRef(0);
  // Cada vez que se pausa o se salta de frase el ciclo sube: un bucle viejo que sigue esperando su audio o su
  // pausa ya no es el vigente y termina sin tocar nada, aunque `playingRef` haya vuelto a ser true.
  const cicloRef = useRef(0);

  const carga = useCarga(
    async () => {
      if (!user) return;
      const list = await getRandomEntries(filter(), 40, { conAudio: true });
      setQueue(list.filter((e) => e.audio_en));
    },
    [user, filter]
  );
  const loading = carga.estado === 'cargando';

  // Las dos voces de la frase actual (son audios distintos) y sus tiempos de palabra: el karaoke del inglés y la onda
  // de cualquiera de las dos. Lo que se dice puede diferir de lo que se ve: los tiempos se calculan sobre lo dicho.
  const actual = queue[idx];
  const vozEn = useVozEnVivo(actual?.audio_en ?? null);
  const vozEs = useVozEnVivo(actual?.audio_es ?? null);
  const analisisEn = useMemo(
    () =>
      actual ? analizar(actual.phrase, actual.phrase_tts || actual.phrase, marcasDe(actual.audio_en), vozEn.duracion) : null,
    [actual, vozEn.duracion]
  );
  const analisisEs = useMemo(
    () =>
      actual?.audio_es
        ? analizar(actual.spanish_main, actual.spanish_main, marcasDe(actual.audio_es), vozEs.duracion)
        : null,
    [actual, vozEs.duracion]
  );

  // Modo bolsillo: sin tocar la pantalla mientras suena, baja el brillo de todo menos el anillo y la frase.
  const { bolsillo, brillo, despertar } = useBolsillo(playing);
  const estiloBrillo = useAnimatedStyle(() => ({ opacity: brillo.value }));

  const detener = useCallback(() => {
    cicloRef.current++;
    playingRef.current = false;
    setPlaying(false);
    audio.stop();
  }, []);

  // Perder el foco apaga el bucle (playingRef/cicloRef) y corta todo el
  // audio al instante, sin esperar a que el bucle note el cambio de ruta.
  useCortarAudioAlSalir(detener);

  useEffect(() => {
    // Al salir de la pantalla o ir a background: corta la voz y el
    // bucle. stop() ya invalida cualquier playAndWait() en camino.
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active' && playingRef.current) detener();
    });
    return () => {
      sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- es un contador, no un nodo: subirlo al desmontar invalida lo que va en camino.
      cicloRef.current++;
      playingRef.current = false;
      audio.stop();
    };
  }, [detener]);

  /** Reproduce una frase completa (o desde el paso `desde`, al reanudar). */
  const reproduceFrase = useCallback(async (entry: Entry, desde: number, vigente: () => boolean) => {
    const pasos = pasosFrase(entry.audio_en, entry.audio_es);
    await audio.playSequence(pasos.slice(desde), vigente, (i) => {
      pasoIdxRef.current = desde + i;
      setPasoIdx(desde + i);
    });
  }, []);

  const loop = useCallback(
    async (desdeIdx: number, desdePaso: number) => {
      const ciclo = ++cicloRef.current;
      const vigente = () => playingRef.current && cicloRef.current === ciclo;
      let i = desdeIdx;
      let desde = desdePaso;
      while (vigente() && i < queue.length) {
        const e = queue[i];
        if (!e) break;
        idxRef.current = i;
        setIdx(i);

        await reproduceFrase(e, desde, vigente);
        desde = 0; // solo la frase reanudada arranca a media secuencia

        if (!vigente()) return; // se pausó a media frase, o se saltó a otra
        i++;
      }
      if (vigente()) {
        playingRef.current = false;
        setPlaying(false);
      }
    },
    [queue, reproduceFrase]
  );

  const alternar = useCallback(() => {
    if (playingRef.current) {
      // Pausar corta el audio ya. pasoIdxRef se queda tal cual: es lo
      // que usa "reanudar" para retomar desde ese mismo paso.
      detener();
      return;
    }
    playingRef.current = true;
    setPlaying(true);
    setEmpezo(true);
    void loop(idxRef.current, pasoIdxRef.current);
  }, [loop, detener]);

  /** Anterior (-1) y siguiente (+1): la frase de destino empieza desde su primera repetición. */
  const saltar = useCallback(
    (delta: 1 | -1) => {
      const destino = idxRef.current + delta;
      if (destino < 0 || destino >= queue.length) return;
      cicloRef.current++;
      audio.stop();
      idxRef.current = destino;
      setIdx(destino);
      pasoIdxRef.current = 0;
      setPasoIdx(0);
      // Si estaba sonando, la frase nueva sigue sonando; si estaba en pausa, queda lista y en pausa.
      if (playingRef.current) void loop(destino, 0);
    },
    [queue.length, loop]
  );

  return { nav, altoVentana, queue, idx, playing, empezo, pasoIdx, carga, loading, actual, vozEn, vozEs, analisisEn, analisisEs, bolsillo, despertar, estiloBrillo, alternar, saltar };
}
