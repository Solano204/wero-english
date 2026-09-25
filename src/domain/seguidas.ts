/**
 * Los aciertos seguidos de una sesión como señal que sube: a partir de 3 la barra
 * empieza a brillar y el brillo da un escalón a los 5 y a los 10. Módulo puro
 * (`npm run check:estudio`). No es una racha que se pierda: al fallar el brillo
 * baja con calma y ya, sin mensaje.
 */

/** Cuántos aciertos seguidos enciende cada escalón (el primero es el que muestra el chip). */
export const ESCALONES_SEGUIDAS = [3, 5, 10] as const;

/** 0 sin brillo; 1, 2 o 3 según cuántos escalones se han pasado. */
export function nivelSeguidas(seguidas: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(seguidas)) return 0;
  const alcanzados = ESCALONES_SEGUIDAS.filter((minimo) => seguidas >= minimo).length;
  return alcanzados as 0 | 1 | 2 | 3;
}
