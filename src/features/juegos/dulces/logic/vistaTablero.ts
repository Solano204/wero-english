import type { Paso } from '@/domain/match3Pasos';
import type { Entrada, Movimiento } from '@/features/juegos/dulces/components/Pieza';
import { retrasoDeColumna } from './tablero';

/** Lo que el tablero de Dulces anima y cómo arranca: los tipos de una jugada y la vista de un tablero nuevo. */

/** Lo que una jugada le pide al tablero que anime. */
export interface Jugada {
  /** Las dos celdas que se intercambian. */
  a: number;
  c: number;
  /** Los pasos de la cascada; vacío si el intercambio no armó nada (las piezas se quedan intercambiadas). */
  pasos: Paso[];
  /** Los colores del tablero rebarajado, si al terminar no quedaba ningún movimiento posible. */
  rebarajado: number[] | null;
  /** Cómo debe quedar el tablero al final: si lo animado no coincide, se corrige. */
  final: number[];
  /** Las piezas de un paso empiezan a estallar: de ahí salen los trozos hacia las barras. */
  onEstallido?: (paso: Paso, indice: number) => void;
  /** Los trozos de un paso llegaron a sus barras: se suman a las metas. */
  onLlegan?: (paso: Paso, indice: number) => void;
  /** Terminó toda la jugada: se puede volver a tocar. */
  onFin: () => void;
}

export interface TableroDulcesRef {
  /** Anima una jugada: el intercambio, cada paso de la cascada y, si hizo falta, el rebarajado. */
  jugar: (jugada: Jugada) => void;
}

export interface PiezaVista {
  id: number;
  color: number;
  fila: number;
  col: number;
  explota: boolean;
  mov: Movimiento | null;
  entrada?: Entrada;
  rechazo: number;
}

/**
 * Las piezas de un tablero recién repartido. Con `conEntrada` cada una cae desde arriba del tablero (un tablero
 * entero más arriba de su celda), columna por columna: la de la izquierda primero, con el escalón de su columna.
 */
export function vistaInicial(
  celdas: readonly number[],
  cols: number,
  rows: number,
  nuevoId: () => number,
  conEntrada: boolean
): PiezaVista[] {
  return celdas.map((color, i) => {
    const fila = Math.floor(i / cols);
    const col = i % cols;
    return {
      id: nuevoId(),
      color,
      fila,
      col,
      explota: false,
      mov: null,
      entrada: conEntrada ? { desde: fila - rows, retraso: retrasoDeColumna(col) } : undefined,
      rechazo: 0,
    };
  });
}
