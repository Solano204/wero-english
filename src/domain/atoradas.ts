/**
 * Lo puro de Se me atoran: el medidor de atasco (cuántos puntos, qué texto), qué tarjetas van más grandes y en qué orden.
 * No importa nada: se prueba con `npm run check:atoradas`. Qué cuenta como atorada (3 fallos o más y no dominada) lo decide
 * `getStuckEntries`, no este archivo.
 */

/** Cuántos puntos tiene el medidor: se encienden tantos como fallos haya, con este tope. */
export const PUNTOS_ATASCO = 5;

/** Cuántos puntos del medidor se encienden con `fallos`. */
export function puntosEncendidos(fallos: number): number {
  return Math.min(PUNTOS_ATASCO, Math.max(0, Math.floor(fallos)));
}

/** «1 fallo», «4 fallos»: el número real, aunque pase del tope de puntos («7 fallos»). */
export function etiquetaFallos(fallos: number): string {
  const n = Math.max(0, Math.floor(fallos));
  return `${n} ${n === 1 ? 'fallo' : 'fallos'}`;
}

export type TamanoAtorada = 'normal' | 'grande';

/** Las que llenan el medidor (5 fallos o más) van levemente más grandes: no todas las tarjetas iguales (IA-2). */
export function tamanoAtorada(fallos: number): TamanoAtorada {
  return fallos >= PUNTOS_ATASCO ? 'grande' : 'normal';
}

/** Las que tienen más fallos arriba; a igual número, por id, para que el orden no baile entre visitas. No modifica la lista. */
export function ordenarAtoradas<T extends { entry: { id: number }; fallos: number }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => b.fallos - a.fallos || a.entry.id - b.entry.id);
}
