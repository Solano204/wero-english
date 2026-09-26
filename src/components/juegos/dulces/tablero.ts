/**
 * La geometría del tablero de Dulces y los números de su animación. Módulo puro (`npm run check:dulces`): no
 * toca la pantalla ni el dominio. Las funciones que corren en el hilo de UI (el swipe) son worklets. Los
 * números de tiempo repiten los de `motionDulces` y `escalon` (theme/motion.ts): una prueba compara que no se
 * desfasen, porque este módulo no puede importar el tema.
 */
import type { Paso } from '@/domain/match3Pasos';

// Los de `motionDulces` (theme/motion.ts).
export const CAIDA_BASE_MS = 120;
export const CAIDA_POR_FILA_MS = 40;
export const REBOTE_MS = 100;
/** Lo que sube la pieza en el rebote al aterrizar, en dp. */
export const REBOTE_DP = 4;
// Los de `escalon` (theme/motion.ts): 40 ms por columna, con tope en la octava.
const ESCALON_MS = 40;
const ESCALON_MAX = 8;

/** Lo más que se retrasa un trozo al salir de su pieza (ms): los trozos de un paso no llegan todos a la vez. */
export const TROZOS_RETRASO_MS = 60;

/** Un número entre 0 y 1 que siempre sale igual para el mismo `i`: la dispersión de los trozos sin gastar `Math.random`. */
export function azarFijo(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Las piezas que se lanzan como trozos en un paso, a lo más: con dos pasos en el aire no pasan de `MAX_VIVAS`. */
export const MAX_POR_PASO = 30;
export const MAX_VIVAS = 60;

/** Cuánto hay de una celda a la siguiente: la pieza más el hueco. */
export function pasoDe(lado: number, hueco: number): number {
  return lado + hueco;
}

/** Dónde queda la esquina de arriba a la izquierda de una celda, en el espacio del tablero. */
export function posicionDe(fila: number, col: number, paso: number): { x: number; y: number } {
  return { x: col * paso, y: fila * paso };
}

/** El retraso con el que entran las piezas nuevas de una columna: el escalón por columna. */
export function retrasoDeColumna(col: number): number {
  return Math.min(Math.max(0, col), ESCALON_MAX - 1) * ESCALON_MS;
}

/** Cuánto tarda en caer una pieza que baja `filas` filas (sin el rebote): la base más lo que suma cada fila. */
export function duracionCaida(filas: number): number {
  return CAIDA_BASE_MS + Math.max(0, filas) * CAIDA_POR_FILA_MS;
}

/** Cuánto tarda en terminar de caer todo un paso: la que más recorre o la que entra más tarde, más el rebote. */
export function esperaDeCaida(paso: Pick<Paso, 'caidas' | 'nuevas'>, cols: number): number {
  let espera = 0;
  for (const c of paso.caidas) espera = Math.max(espera, duracionCaida((c.hasta - c.desde) / cols));
  for (const n of paso.nuevas) {
    const filas = Math.floor(n.indice / cols) - n.desde;
    espera = Math.max(espera, retrasoDeColumna(n.indice % cols) + duracionCaida(filas));
  }
  return espera + REBOTE_MS;
}

/** La celda bajo un punto del tablero (índice fila * cols + columna), o -1 si cae fuera. */
export function celdaEn(x: number, y: number, paso: number, cols: number, rows: number): number {
  'worklet';
  if (!(paso > 0)) return -1;
  const col = Math.floor(x / paso);
  const fila = Math.floor(y / paso);
  if (col < 0 || col >= cols || fila < 0 || fila >= rows) return -1;
  return fila * cols + col;
}

/** Cuánto hay que deslizar el dedo desde una pieza para que cuente como intercambio. */
export function umbralDeslizar(lado: number): number {
  return Math.max(12, lado * 0.4);
}

export interface Destino {
  /** La celda a la que apunta el deslizamiento; `-1` si es hacia fuera del tablero. */
  celda: number;
  /** Hacia dónde iba: para devolver la pieza con un rebote si no hay a dónde ir. */
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
}

/**
 * A qué celda vecina apunta un deslizamiento que salió de `origen`: manda el eje en el que el dedo recorrió
 * más. Con `soloHorizontal` (el tablero scrollea y lo vertical es del scroll) un deslizamiento vertical no es
 * un intercambio.
 */
export function vecinaHacia(
  origen: number,
  dx: number,
  dy: number,
  cols: number,
  rows: number,
  soloHorizontal: boolean
): Destino | null {
  'worklet';
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (!horizontal && soloHorizontal) return null;
  const pasoX = horizontal ? (dx > 0 ? 1 : -1) : 0;
  const pasoY = horizontal ? 0 : dy > 0 ? 1 : -1;
  const fila = Math.floor(origen / cols) + pasoY;
  const col = (origen % cols) + pasoX;
  const dentro = fila >= 0 && fila < rows && col >= 0 && col < cols;
  return { celda: dentro ? fila * cols + col : -1, dx: pasoX as -1 | 0 | 1, dy: pasoY as -1 | 0 | 1 };
}

/** Cuántos trozos suelta cada pieza que se va: de 1 a 3, y nunca más de `MAX_POR_PASO` en total en un paso. */
export function trozosPorPieza(piezas: number): number {
  if (piezas <= 0) return 0;
  return Math.max(1, Math.min(3, Math.floor(MAX_POR_PASO / piezas)));
}

/** El total de trozos de un paso con `piezas` piezas quitadas. */
export function trozosDelPaso(piezas: number): number {
  return Math.min(MAX_POR_PASO, Math.max(0, piezas) * trozosPorPieza(piezas));
}
