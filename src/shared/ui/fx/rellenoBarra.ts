import type { LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

/**
 * El relleno de una barra que se llena o se vacía, sin animar `width`.
 *
 * Animar `width` en cada cuadro obliga a recalcular el layout (Yoga) y a montarlo otra vez; un `translateX` solo mueve
 * una capa en el hilo de UI. El relleno mide lo mismo que la pista (ancho completo) y se corre a la izquierda lo que
 * falta; la pista lleva `overflow: 'hidden'`, así que se ve igual que antes. Hasta medir el ancho se corre en porcentaje,
 * para que el primer cuadro ya esté en su lugar.
 */
export function useAnchoRelleno() {
  const ancho = useSharedValue(0);
  const alMedir = (e: LayoutChangeEvent) => ancho.set(e.nativeEvent.layout.width);
  return { ancho, alMedir };
}

/** El `translateX` del relleno para que se vea `fraccion` (0 a 1) de la barra, desde la izquierda. */
export function corrimientoRelleno(fraccion: number, ancho: number): number | `${number}%` {
  'worklet';
  const f = Math.min(Math.max(fraccion, 0), 1);
  return ancho > 0 ? -(1 - f) * ancho : `${-(1 - f) * 100}%`;
}
