/**
 * El tablero de Dulces como ÚNICA fuente de verdad: un reducer puro sobre el motor de tres en línea.
 *
 * Todo lo que decide una jugada se decide aquí, con el estado actual y sin tocar la pantalla: si el intercambio
 * es de vecinas, si arma línea, la cascada entera (la lista de pasos), los ids de las piezas y el rebarajado. La
 * vista solo dibuja lo que este estado dice y lo anima; ninguna animación decide nada. El azar llega en la
 * acción (`semilla`), no se saca dentro del reducer: así el reducer es puro y se puede repetir y probar.
 *
 *   intercambiar → rechazo   (no vecinas, o no arma línea: el modelo NO cambia ni se cobra la jugada)
 *   intercambiar → jugada    (el modelo ya queda en su estado final: cascada resuelta, ids y rebarajado listos)
 *   terminar                 (la vista acabó de dibujar la jugada: se vuelve a aceptar un intercambio)
 */
import { clone, hayMovimiento, intercambioValido, rebarajar, sonVecinas, swap, type Board, type Rand } from './match3';
import { idsTrasPaso, idsTrasRebaraje, resolverPorPasos, type Paso } from './match3Pasos';

/** Un azar con semilla (mulberry32): la misma semilla da siempre la misma secuencia. */
export function azarConSemilla(semilla: number): Rand {
  let a = semilla | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Todo lo que pasó en una jugada válida, ya resuelto: la vista solo lo reproduce. */
export interface JugadaResuelta {
  a: number;
  c: number;
  /** Los pasos de la cascada (al menos uno: un intercambio que no arma línea nunca llega aquí). */
  pasos: Paso[];
  porColor: Record<number, number>;
  /** El id de la pieza de cada celda antes de la jugada. */
  idsAntes: number[];
  /** El id de la pieza de cada celda: justo después del intercambio, tras cada paso y al final. */
  idsIntercambio: number[];
  idsPasos: number[][];
  /** Los colores y ids del tablero rebarajado, si al terminar no quedaba ningún movimiento posible. */
  rebarajado: number[] | null;
  idsRebaraje: number[] | null;
  /** Cómo queda el tablero al final (colores e ids): es el modelo. */
  final: number[];
  idsFinal: number[];
}

export type MotivoRechazo = 'no-vecinas' | 'sin-linea' | 'fuera';

/** Lo último que pasó. `n` sube con cada evento: es lo que la pantalla mira para reaccionar una sola vez. */
export type EventoTablero =
  | { n: number; tipo: 'rechazo'; a: number; c: number; motivo: MotivoRechazo }
  | { n: number; tipo: 'jugada'; jugada: JugadaResuelta };

export interface EstadoTablero {
  /** Ya se armó un tablero (antes de eso no hay nada que jugar). */
  cargado: boolean;
  board: Board;
  /** El id de la pieza de cada celda; estable mientras la pieza vive (baja, se mueve, pero es la misma). */
  ids: number[];
  siguienteId: number;
  colores: number;
  jugadas: number;
  /** Hay una jugada dibujándose: no se acepta otro intercambio hasta `terminar`. */
  ocupado: boolean;
  n: number;
  evento: EventoTablero | null;
}

export type AccionTablero =
  | { tipo: 'armar'; board: Board; colores: number; jugadas: number }
  | { tipo: 'intercambiar'; a: number; c: number; semilla: number }
  | { tipo: 'terminar' };

export const TABLERO_VACIO: EstadoTablero = {
  cargado: false,
  board: { cols: 0, rows: 0, cells: [] },
  ids: [],
  siguienteId: 0,
  colores: 0,
  jugadas: 0,
  ocupado: false,
  n: 0,
  evento: null,
};

function rechazo(s: EstadoTablero, a: number, c: number, motivo: MotivoRechazo): EstadoTablero {
  const n = s.n + 1;
  return { ...s, n, evento: { n, tipo: 'rechazo', a, c, motivo } };
}

/** Un intercambio válido: aplica el intercambio, resuelve la cascada entera y deja todo listo (ids incluidos). */
function jugar(s: EstadoTablero, a: number, c: number, semilla: number): EstadoTablero {
  const azar = azarConSemilla(semilla);
  const nuevo = clone(s.board);
  swap(nuevo, a, c);
  const idsIntercambio = [...s.ids];
  [idsIntercambio[a], idsIntercambio[c]] = [s.ids[c] as number, s.ids[a] as number];

  const res = resolverPorPasos(nuevo, s.colores, azar);
  let siguienteId = s.siguienteId;
  const nuevoId = () => siguienteId++;
  const idsPasos: number[][] = [];
  let ids = idsIntercambio;
  for (const paso of res.pasos) {
    ids = idsTrasPaso(ids, paso, nuevoId);
    idsPasos.push(ids);
  }

  let final = nuevo;
  let rebarajado: number[] | null = null;
  let idsRebaraje: number[] | null = null;
  if (!hayMovimiento(nuevo)) {
    const otro = clone(nuevo);
    rebarajar(otro, s.colores, azar);
    rebarajado = otro.cells;
    idsRebaraje = idsTrasRebaraje(nuevo.cells, ids, otro.cells, nuevoId).ids;
    ids = idsRebaraje;
    final = otro;
  }

  const n = s.n + 1;
  const jugada: JugadaResuelta = {
    a,
    c,
    pasos: res.pasos,
    porColor: res.porColor,
    idsAntes: s.ids,
    idsIntercambio,
    idsPasos,
    rebarajado,
    idsRebaraje,
    final: final.cells,
    idsFinal: ids,
  };
  return {
    ...s,
    board: final,
    ids,
    siguienteId,
    jugadas: s.jugadas - 1,
    ocupado: true,
    n,
    evento: { n, tipo: 'jugada', jugada },
  };
}

export function tableroReducer(s: EstadoTablero, accion: AccionTablero): EstadoTablero {
  switch (accion.tipo) {
    case 'armar': {
      const { board, colores, jugadas } = accion;
      return {
        cargado: true,
        board,
        ids: board.cells.map((_, i) => s.siguienteId + i),
        siguienteId: s.siguienteId + board.cells.length,
        colores,
        jugadas,
        ocupado: false,
        n: s.n + 1,
        evento: null,
      };
    }
    case 'intercambiar': {
      const { a, c, semilla } = accion;
      // Sin tablero, con una jugada dibujándose o sin jugadas: no se hace nada (no es un rechazo que se sacuda).
      if (!s.cargado || s.ocupado || s.jugadas <= 0) return s;
      const total = s.board.cells.length;
      if (!Number.isInteger(a) || !Number.isInteger(c) || a < 0 || c < 0 || a >= total || c >= total) {
        return rechazo(s, a, c, 'fuera');
      }
      if (!sonVecinas(s.board, a, c)) return rechazo(s, a, c, 'no-vecinas');
      if (!intercambioValido(s.board, a, c)) return rechazo(s, a, c, 'sin-linea');
      return jugar(s, a, c, semilla);
    }
    case 'terminar':
      return s.ocupado ? { ...s, ocupado: false } : s;
  }
}
