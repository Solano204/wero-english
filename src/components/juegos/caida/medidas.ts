/**
 * Las medidas de la pista de Caída: cuánto baja la fila de fichas, dónde queda el piso y
 * cuándo empieza a avisar. Módulo puro (`npm run check:caida`): no toca la pantalla ni el
 * dominio (`domain/caida.ts` sigue decidiendo cuánto dura cada caída). Las funciones que
 * corren en el hilo de UI son worklets.
 */

/** Las fichas miden esto exacto (área táctil de 96 dp): la caída cuenta con ello y no las deja crecer. */
export const ALTO_FICHA = 96;
/** El piso. */
export const ALTO_PISO = 4;
/** Aire entre el borde de arriba de la pista y la fila al empezar (`space.lg`). */
export const MARGEN_ARRIBA = 16;
/** Aire entre el piso y el borde de abajo de la pista (`space.md`). */
export const MARGEN_PISO = 12;
/** Una pista más baja que esto no tiene caída que valga: se le da este recorrido mínimo. */
export const CAIDA_MINIMA = 80;

/** Desde este avance (0 a 1) el piso empieza a encenderse. */
export const RESPLANDOR_DESDE = 0.7;
/** En este avance la fila da el aviso: un háptico ligero y un pulso del piso. Es el aviso, no un castigo. */
export const AVISO_EN = 0.75;

/**
 * Cuánto baja la fila, del borde de arriba a tocar el piso: la pista menos lo que ocupan la fila
 * (arriba y ella misma), el piso y el aire de abajo. Así la ficha se detiene exactamente sobre él.
 */
export function distanciaCaida(alturaPista: number): number {
  const d = alturaPista - MARGEN_ARRIBA - ALTO_FICHA - ALTO_PISO - MARGEN_PISO;
  return Number.isFinite(d) ? Math.max(CAIDA_MINIMA, d) : CAIDA_MINIMA;
}

/** Qué tan cerca del piso va la fila: 0 al arrancar y 1 al tocarlo. */
export function avance(y: number, distancia: number): number {
  'worklet';
  if (!(distancia > 0)) return 0;
  return Math.min(1, Math.max(0, y / distancia));
}

/** Cuánto se enciende el piso (0 a 1): nada hasta `RESPLANDOR_DESDE` y todo al tocarlo. */
export function resplandor(p: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (p - RESPLANDOR_DESDE) / (1 - RESPLANDOR_DESDE)));
}
