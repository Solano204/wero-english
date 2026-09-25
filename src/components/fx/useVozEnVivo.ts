import { useEffect, useState } from 'react';
import { cancelAnimation, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import * as audio from '@/services/audio';
import { motionDuration, motionEasing, motionSenal } from '@/theme';
import { useSenalActiva } from './useSenalActiva';

/** Cuánto se espera a que el reproductor arranque de verdad antes de darlo por perdido. */
const ARRANQUE_MAX_MS = 1500;
/** Margen antes del final de la duración con el que ya se da por terminado. */
const FIN_MARGEN_S = 0.03;

export interface VozEnVivo {
  /** Posición en segundos del audio (no del reloj: con «Lento» avanza más despacio). */
  pos: SharedValue<number>;
  /** 0 en reposo, 1 mientras suena; baja en `base` al terminar. */
  activa: SharedValue<number>;
  /** Duración real en segundos; 0 hasta que el reproductor la conoce. */
  duracion: number;
  /** El último audio que arrancó fue el lento. */
  lenta: boolean;
  /** El sistema pidió reducir movimiento: el karaoke cambia de color sin transiciones y la onda no se mueve. */
  reducido: boolean;
}

/**
 * La voz que suena, para la onda y el karaoke de Estudio. No reproduce ni
 * controla nada: escucha cuándo arranca la frase de esta tarjeta y, mientras
 * suena, lee su posición cada `muestreo` ms. Si esto falla o no corre, el audio
 * suena igual (MOT-4: no lee nada sin foco ni en segundo plano).
 */
export function useVozEnVivo(ruta: string | null): VozEnVivo {
  const { activo, reducido } = useSenalActiva();
  // Con reducir movimiento el karaoke sigue cambiando de color: solo se quita el movimiento.
  const vivo = activo || reducido;
  const pos = useSharedValue(-1);
  const activa = useSharedValue(0);
  const [duracion, setDuracion] = useState(0);
  const [lenta, setLenta] = useState(false);

  useEffect(() => {
    if (!ruta || !vivo) return;
    let reloj: ReturnType<typeof setInterval> | null = null;
    let velocidad = 1;
    let arrancoEn = 0;
    let sono = false;

    const terminar = () => {
      if (reloj) {
        clearInterval(reloj);
        reloj = null;
      }
      activa.value = reducido ? 0 : withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir });
    };

    const muestrear = () => {
      const { pos: p, dur } = audio.progresoFrase();
      const suena = audio.isPlaying();
      if (suena) sono = true;
      if (dur > 0) setDuracion((d) => (d === dur ? d : dur));
      if (!sono) {
        if (Date.now() - arrancoEn > ARRANQUE_MAX_MS) terminar();
        return;
      }
      if (!suena || (dur > 0 && p >= dur - FIN_MARGEN_S)) {
        terminar();
        return;
      }
      // Se apunta a donde estará el audio en la próxima lectura: sin escalones ni retraso.
      pos.value = reducido
        ? p
        : withTiming(p + (motionSenal.muestreo / 1000) * velocidad, {
            duration: motionSenal.muestreo,
            easing: motionEasing.lineal,
          });
    };

    const alArrancar = (e: audio.ArranqueFrase) => {
      if (e.ruta !== ruta) {
        // Otro audio tomó el reproductor: esta frase ya no suena.
        if (reloj) terminar();
        return;
      }
      velocidad = e.rate;
      setLenta(e.rate < 1);
      sono = false;
      arrancoEn = Date.now();
      cancelAnimation(pos);
      pos.value = 0;
      activa.value = reducido ? 1 : withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar });
      if (!reloj) reloj = setInterval(muestrear, motionSenal.muestreo);
    };

    const dejarDeEscuchar = audio.alReproducir(alArrancar);
    return () => {
      dejarDeEscuchar();
      if (reloj) clearInterval(reloj);
      cancelAnimation(pos);
      cancelAnimation(activa);
      activa.value = 0;
    };
  }, [ruta, vivo, reducido, pos, activa]);

  return { pos, activa, duracion, lenta, reducido };
}
