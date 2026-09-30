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

/** Cuántos chevrons tiene el indicador de ritmo. */
export const CHEVRONS = 5;
/** La estela cubre lo que la ficha recorrió en este tiempo (s): a más velocidad, más larga. */
export const TIEMPO_ESTELA_S = 0.25;
export const ESTELA_MIN = 12;
export const ESTELA_MAX = 72;

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

/**
 * El largo de la estela de una ronda: lo que recorre la fila en `TIEMPO_ESTELA_S` a la velocidad de
 * la ronda (`distancia` dp en `duracionMs`), entre `ESTELA_MIN` y `ESTELA_MAX`. La caída es lineal,
 * así que el largo es fijo durante la ronda y crece de una ronda a la siguiente.
 */
export function largoEstela(distancia: number, duracionMs: number): number {
  if (!(distancia > 0) || !(duracionMs > 0)) return ESTELA_MIN;
  const velocidad = distancia / (duracionMs / 1000);
  return Math.min(ESTELA_MAX, Math.max(ESTELA_MIN, velocidad * TIEMPO_ESTELA_S));
}

/**
 * Cuántos chevrons se encienden (1 a `CHEVRONS`): dónde queda la duración de la ronda entre la
 * inicial y la mínima del nivel. Cada nivel trae su propio ritmo; las constantes de
 * `domain/caida.ts` solo son el de respaldo.
 */
export function chevronsPara(duracionMs: number, inicialMs: number, minimaMs: number): number {
  const rango = inicialMs - minimaMs;
  if (!(rango > 0) || !Number.isFinite(duracionMs)) return 1;
  const t = Math.min(1, Math.max(0, (inicialMs - duracionMs) / rango));
  return 1 + Math.round(t * (CHEVRONS - 1));
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
