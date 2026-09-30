import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color, motionDuration, motionEasing, motionPulso, motionSacudida } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

export type Resultado = 'acierto' | 'fallo';

/** Color de la pieza según el resultado: el `correct` y el `wrong` (ámbar) de siempre. */
export const estiloResultado = {
  acierto: { backgroundColor: color.correctSoft, borderColor: color.correct },
  fallo: { backgroundColor: color.wrongSoft, borderColor: color.wrong },
} as const;

/**
 * El efecto de acierto y de fallo, IGUAL en todos los juegos.
 *
 *  - Acierto: pulso de escala 1 → 1.04 → 1 en `base`.
 *  - Fallo: sacudida horizontal (3 oscilaciones de ±6 px) en `base`.
 *
 * Con "reducir movimiento" no se mueve nada: queda el color, que lo pone
 * quien usa esto, y el háptico y el sonido, que ya ponen las pantallas.
 * El color no se anima aquí: cambia con el estado de la pieza.
 *
 * `useValoresResultado` da solo los valores (lo usa `Presionable`, que arma su
 * propia transformación); `useEfectoResultado` añade el estilo listo.
 */
export function useValoresResultado() {
  const reducido = useMovimientoReducido();
  const dx = useSharedValue(0);
  const pulso = useSharedValue(1);

  const acierto = useCallback(() => {
    if (reducido) return;
    const mitad = motionDuration.base / 2;
    pulso.value = withSequence(
      withTiming(motionPulso.escala, { duration: mitad, easing: motionEasing.entrar }),
      withTiming(1, { duration: mitad, easing: motionEasing.salir })
    );
  }, [reducido, pulso]);

  const fallo = useCallback(() => {
    if (reducido) return;
    const pasos = motionSacudida.oscilaciones * 2 + 1;
    const duracion = motionDuration.base / pasos;
    const tramo = (a: number) => withTiming(a, { duration: duracion, easing: motionEasing.entrar });
    const swings = Array.from({ length: motionSacudida.oscilaciones * 2 }, (_, i) =>
      tramo(i % 2 === 0 ? motionSacudida.amplitud : -motionSacudida.amplitud)
    );
    dx.value = withSequence(...swings, tramo(0));
  }, [reducido, dx]);

  const disparar = useCallback(
    (r: Resultado | null | undefined) => {
      if (r === 'acierto') acierto();
      else if (r === 'fallo') fallo();
    },
    [acierto, fallo]
  );

  return { dx, pulso, acierto, fallo, disparar };
}

/** Para una vista que no es tocable: `<Animated.View style={estilo}>`. */
export function useEfectoResultado() {
  const valores = useValoresResultado();
  const { dx, pulso } = valores;
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { scale: pulso.value }],
  }));
  return { ...valores, estilo };
}
