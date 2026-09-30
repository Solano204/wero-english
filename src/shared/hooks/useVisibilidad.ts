import { useEffect, useState } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  measure,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

/** Cuánto del desplazamiento de la pantalla se traslada a la portada (parallax). */
const FACTOR_PARALAJE = 0.15;
/** Tope del desfase (dp): la portada trae ese sobrante arriba y abajo. */
export const MARGEN_PARALAJE = 12;

/**
 * Dice, en el hilo de UI, si un elemento está a la vista y cuánto se desplaza su
 * portada respecto de la tarjeta.
 *
 * NO mide en cada cuadro: `alAcomodar` (va a `onLayout`) mide una sola vez,
 * cuando la vista ya tiene layout de verdad, y guarda su posición junto con el
 * scroll de ese momento. La reacción de cada cuadro solo hace aritmética
 * (cuánto se movió el scroll desde esa medición), sin volver a llamar
 * measure() — que es justo lo que podía tronar con un `null` nativo si corría
 * antes de que la vista existiera (pantalla todavía cargando, ver
 * ProgressScreen), después de desmontarse al navegar, o sobre un ref que
 * nunca llegó a un nodo nativo.
 *
 * Devuelve «no visible» sin medir nada si la pantalla perdió el foco
 * (`useIsFocused`) o la app pasó a segundo plano (`AppState`).
 */
export function useVisibilidad(scrollY: SharedValue<number>) {
  const ref = useAnimatedRef<Animated.View>();
  const { height: pantalla } = useWindowDimensions();
  const enfocada = useIsFocused();
  const [primerPlano, setPrimerPlano] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => setPrimerPlano(estado === 'active'));
    return () => sub.remove();
  }, []);

  const activa = useSharedValue(enfocada && primerPlano);
  useEffect(() => {
    activa.value = enfocada && primerPlano;
  }, [enfocada, primerPlano, activa]);

  const visible = useSharedValue(0);
  const desfase = useSharedValue(0);
  // Posición (pageY) y alto del último layout, y el scroll que había en ese
  // momento: con el scroll actual arman el pageY de ahora sin medir de nuevo.
  // `null` = todavía sin una medición válida (sin layout, o desmontada).
  const posicion = useSharedValue<number | null>(null);
  const scrollEnMedida = useSharedValue(0);
  const alto = useSharedValue(0);

  const alAcomodar = () => {
    runOnUI(() => {
      'worklet';
      const m = measure(ref);
      // Sin layout todavía, ya desmontada, o el ref no llegó a un nodo nativo:
      // se queda sin medición, y la reacción de abajo la trata como no visible.
      if (m === null) return;
      posicion.value = m.pageY;
      scrollEnMedida.value = scrollY.value;
      alto.value = m.height;
    })();
  };

  useAnimatedReaction(
    () => ({ scroll: scrollY.value, y: posicion.value, h: alto.value, activa: activa.value }),
    (ahora) => {
      if (!ahora.activa || ahora.y === null) {
        visible.value = 0;
        return;
      }
      const pageY = ahora.y - (ahora.scroll - scrollEnMedida.value);
      visible.value = pageY < pantalla && pageY + ahora.h > 0 ? 1 : 0;
      const centro = pageY + ahora.h / 2 - pantalla / 2;
      desfase.value = Math.max(-MARGEN_PARALAJE, Math.min(MARGEN_PARALAJE, -centro * FACTOR_PARALAJE));
    }
  );

  return { ref, visible, desfase, alAcomodar };
}

/**
 * Como `useVisibilidad`, y además avisa una sola vez (estado de React, no por cuadro)
 * cuando el elemento entra a la vista: para animar una sección al llegar con el scroll.
 */
export function useVisto(scrollY: SharedValue<number>) {
  const { ref, visible, alAcomodar } = useVisibilidad(scrollY);
  const [visto, setVisto] = useState(false);
  useAnimatedReaction(
    () => visible.value,
    (ahora, antes) => {
      if (ahora === 1 && antes !== 1) runOnJS(setVisto)(true);
    }
  );
  return { ref, alAcomodar, visto };
}
