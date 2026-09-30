import { space } from '@/theme';

/** Valores de respaldo si niveles.json no cargó. */
export const RESPALDO_DULCES = {
  COLS_DEF: 7,
  ROWS_DEF: 8,
  COLORES_DEF: 5,
  JUGADAS_DEF: 22,
  META_DEF: 9,
};

/**
 * El lado de la pieza depende de cuántas columnas pida el nivel. El tablero usa casi todo el ancho (márgenes
 * y huecos de `space.xs`) para acercarse a los 48 dp: con 8 columnas en un teléfono de 360 dp salen de 42 y el
 * área táctil se completa con `hitSlop` (ver `Pieza`).
 */
export function ladoPara(cols: number, anchoVentana: number): number {
  return Math.floor((anchoVentana - space.xs * 2 - (cols - 1) * space.xs) / cols);
}
