import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { hayAudio } from '@/components/card/AudioButton';
import * as audio from '@/services/audio';

export type EstadoCapitulo = 'idle' | 'cargando' | 'sonando' | 'pausado';

const TICK_MS = 250;
/** Cada cuánto se lee la posición para el texto acompañado (solo mientras suena): las oraciones duran segundos. */
const MUESTREO_MS = 100;
/** El player se queda un pelo antes de la duración al terminar. */
const FIN_MARGEN_S = 0.3;
const SIN_PROGRESO = { pos: 0, dur: 0 };
/** Cada cuánto (s de audio) se publica el progreso a React: la barra y el reloj. */
const PASO_PROGRESO_S = 0.5;

export interface ReproductorCapitulo {
  estado: EstadoCapitulo;
  /** Posición y duración en segundos. `dur` es 0 hasta que el reproductor la conoce. */
  progreso: { pos: number; dur: number };
  /** No hay audio, no existe el archivo o falló al pedirlo. */
  apagado: boolean;
  /** El audio llegó a su fin solo (no lo detuvo el usuario). Se apaga al volver a escuchar. */
  terminado: boolean;
  escuchar: () => Promise<void>;
  pausar: () => void;
  reanudar: () => void;
  detener: () => void;
  /** Lleva el audio a `seg` sin cambiar si suena o está en pausa. */
  saltar: (seg: number) => Promise<void>;
  /** La posición en segundos, en el hilo de UI, para el texto acompañado y la onda. */
  pos: SharedValue<number>;
  /** 1 mientras suena; 0 en pausa o en reposo (la onda se aplana). */
  sonando: SharedValue<number>;
  /** 1 mientras el capítulo suena o está en pausa (el texto sigue resaltando la oración por donde va). */
  enCurso: SharedValue<number>;
}

/**
 * La lógica del reproductor del audio de un capítulo: escuchar, pausar, reanudar donde iba y detener, con su avance y su
 * fin natural. Usa el mismo player de frases que el resto de la app. Si otro botón lo toma (cambia la generación),
 * vuelve a reposo sin llamar a stop(): el audio ya es de otro. Al desmontarse o al cambiar de capítulo (`path`) corta lo
 * suyo. Al irse a segundo plano pausa, no corta, para poder reanudar.
 *
 * Además publica la posición como valor compartido para que el texto resalte la oración que suena sin pasar por React.
 */
export function useReproductorCapitulo(path: string | null): ReproductorCapitulo {
  const [estado, setEstado] = useState<EstadoCapitulo>('idle');
  const [progreso, setProgreso] = useState(SIN_PROGRESO);
  const [fallo, setFallo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  // El cleanup y los intervalos no ven el state nuevo: necesitan refs.
  const estadoRef = useRef<EstadoCapitulo>('idle');
  const genRef = useRef(0);
  const pos = useSharedValue(0);
  const sonando = useSharedValue(0);
  const enCurso = useSharedValue(0);

  const cambiar = useCallback(
    (e: EstadoCapitulo) => {
      estadoRef.current = e;
      setEstado(e);
      sonando.value = e === 'sonando' ? 1 : 0;
      enCurso.value = e === 'sonando' || e === 'pausado' ? 1 : 0;
    },
    [sonando, enCurso]
  );

  const aReposo = useCallback(() => {
    cambiar('idle');
    setProgreso(SIN_PROGRESO);
    pos.value = 0;
  }, [cambiar, pos]);

  // Otro capítulo (otro audio) o salir de la pantalla: se corta lo suyo y se vuelve a reposo.
  useEffect(() => {
    aReposo();
    setFallo(false);
    setTerminado(false);
    return () => {
      if (estadoRef.current !== 'idle') audio.stop();
    };
  }, [path, aReposo]);

  // Se registra para que audio.detenerTodo() (corte global al navegar, al
  // pasar a segundo plano, o el de la propia pantalla al perder el foco)
  // también deje este estado en reposo al instante: sin esto, el player ya
  // está cortado pero la barra se queda mostrando "sonando" hasta el
  // siguiente tick del intervalo de progreso.
  useEffect(() => {
    return audio.registrarCorte(() => {
      if (estadoRef.current !== 'idle') aReposo();
    });
  }, [aReposo]);

  // Avance de la barra y fin natural: solo mientras suena.
  useEffect(() => {
    if (estado !== 'sonando') return;
    const id = setInterval(() => {
      if (audio.generacionActual() !== genRef.current) {
        aReposo();
        return;
      }
      const p = audio.progresoFrase();
      // Solo cuando cambia algo que se ve (el reloj va en segundos; la barra se desliza sola entre
      // pasos): repintar la pantalla de la lectura en cada tick era trabajo sin cambio visible.
      setProgreso((antes) =>
        antes.dur === p.dur && Math.floor(antes.pos / PASO_PROGRESO_S) === Math.floor(p.pos / PASO_PROGRESO_S) ? antes : p
      );
      if (!audio.isPlaying() && p.dur > 0 && p.pos >= p.dur - FIN_MARGEN_S) {
        setTerminado(true);
        aReposo();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [estado, aReposo]);

  // La posición para el texto, más fina que la de la barra.
  useEffect(() => {
    if (estado !== 'sonando') return;
    const id = setInterval(() => {
      pos.value = audio.progresoFrase().pos;
    }, MUESTREO_MS);
    return () => clearInterval(id);
  }, [estado, pos]);

  // Al irse a segundo plano se pausa (no se corta) para poder reanudar.
  useEffect(() => {
    if (estado !== 'sonando') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') return;
      audio.pauseFrase();
      cambiar('pausado');
    });
    return () => sub.remove();
  }, [estado, cambiar]);

  const escuchar = useCallback(async () => {
    cambiar('cargando');
    setTerminado(false);
    const ok = await audio.play(path);
    if (!ok) {
      setFallo(true);
      aReposo();
      return;
    }
    genRef.current = audio.generacionActual();
    cambiar('sonando');
  }, [path, cambiar, aReposo]);

  const pausar = useCallback(() => {
    audio.pauseFrase();
    cambiar('pausado');
  }, [cambiar]);

  const reanudar = useCallback(() => {
    if (audio.generacionActual() !== genRef.current || !audio.resumeFrase()) {
      aReposo();
      return;
    }
    cambiar('sonando');
  }, [cambiar, aReposo]);

  const detener = useCallback(() => {
    audio.stop();
    aReposo();
  }, [aReposo]);

  const saltar = useCallback(
    async (seg: number) => {
      if (estadoRef.current !== 'sonando' && estadoRef.current !== 'pausado') return;
      if (!(await audio.saltarFrase(seg))) return;
      pos.value = seg;
      setProgreso((p) => ({ ...p, pos: seg }));
    },
    [pos]
  );

  return {
    estado,
    progreso,
    apagado: fallo || !hayAudio(path),
    terminado,
    escuchar,
    pausar,
    reanudar,
    detener,
    saltar,
    pos,
    sonando,
    enCurso,
  };
}
