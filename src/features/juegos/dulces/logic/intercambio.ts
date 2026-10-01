import { clone, hayMovimiento, intercambioValido, rebarajar, sonVecinas, swap, type Board, type Rand } from '@/domain/match3';
import { resolverPorPasos, type ResolucionPasos } from '@/domain/match3Pasos';

/**
 * Qué pasa con un intercambio de Dulces. Es la ÚNICA función que decide una jugada: recibe el tablero actual del
 * modelo y devuelve el resultado completo (cascada y, si hace falta, el rebarajado) ANTES de que se anime nada. La
 * vista solo dibuja lo que esto dice; si una animación se corta, el modelo ya está bien.
 *
 * Nunca toca `actual`: un intercambio rechazado deja el tablero exactamente igual.
 */
export type Decision =
  | { tipo: 'rechazo'; motivo: 'no-vecinas' | 'sin-linea' }
  | {
      tipo: 'jugada';
      /** El tablero al terminar la cascada (y el rebarajado, si hubo). */
      tablero: Board;
      /** La cascada paso a paso, para animarla y repartir lo quitado entre las metas. */
      res: ResolucionPasos;
      /** Los colores del tablero rebarajado, si al terminar no quedaba ningún movimiento. */
      rebarajado: number[] | null;
    };

export function decidirIntercambio(actual: Board, a: number, c: number, colores: number, rand: Rand = Math.random): Decision {
  // Tres en línea clásico: solo vecinas directas (arriba, abajo, izquierda o derecha), y solo si arma línea.
  if (!sonVecinas(actual, a, c)) return { tipo: 'rechazo', motivo: 'no-vecinas' };
  if (!intercambioValido(actual, a, c)) return { tipo: 'rechazo', motivo: 'sin-linea' };

  const tablero = clone(actual);
  swap(tablero, a, c);
  const res = resolverPorPasos(tablero, colores, rand);

  let rebarajado: number[] | null = null;
  if (!hayMovimiento(tablero)) {
    rebarajar(tablero, colores, rand);
    rebarajado = [...tablero.cells];
  }
  return { tipo: 'jugada', tablero, res, rebarajado };
}

/** Un tablero en reposo está lleno: ninguna celda vacía y cada color dentro de rango. */
export function tableroLleno(b: Board, colores: number): boolean {
  return b.cells.length === b.cols * b.rows && b.cells.every((v) => Number.isInteger(v) && v >= 0 && v < colores);
}
