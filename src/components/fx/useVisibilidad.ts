import { useWindowDimensions } from 'react-native';
import Animated, {
  measure,
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
 * portada respecto de la tarjeta. `alAcomodar` se pasa a `onLayout` para medir
 * también antes del primer scroll. Sin JS por cuadro.
 */
export function useVisibilidad(scrollY: SharedValue<number>) {
  const ref = useAnimatedRef<Animated.View>();
  const { height: pantalla } = useWindowDimensions();
  const visible = useSharedValue(0);
  const desfase = useSharedValue(0);
  const medidas = useSharedValue(0);

  useAnimatedReaction(
    () => scrollY.value + medidas.value,
    () => {
      const m = measure(ref);
      if (m === null) return;
      visible.value = m.pageY < pantalla && m.pageY + m.height > 0 ? 1 : 0;
      const centro = m.pageY + m.height / 2 - pantalla / 2;
      desfase.value = Math.max(-MARGEN_PARALAJE, Math.min(MARGEN_PARALAJE, -centro * FACTOR_PARALAJE));
    }
  );

  const alAcomodar = () => {
    medidas.value += 1;
  };

  return { ref, visible, desfase, alAcomodar };
}
