import type { Paso } from '@/domain/match3Pasos';
import type { JugadaResuelta } from '@/domain/match3Partida';
import type { Entrada, Movimiento } from '@/features/juegos/dulces/components/Pieza';
import { retrasoDeColumna } from './tablero';

/**
 * Lo que el tablero de Dulces anima y cómo se arma su vista. Todo es puro: la vista (`PiezaVista[]`) siempre se
 * calcula DESDE el modelo (los colores y los ids por celda que da `domain/match3Partida.ts`); aquí no se decide
 * nada del juego, solo se dice dónde va cada pieza y cómo llega. Se prueba desde node (`npm run check:dulces`).
 */

/** Lo que una jugada le pide al tablero que anime: la jugada ya resuelta por el dominio y los avisos de la pantalla. */
export interface Jugada extends JugadaResuelta {
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
  /** El intercambio no arma línea: las dos piezas se sacuden y se quedan en su lugar. */
  rechazar: (a: number, c: number) => void;
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
  /** Hacia dónde «va» al ser rechazada (la vecina con la que se quiso intercambiar); sin vecina, solo se sacude. */
  ida?: Ida;
}

/** Un paso de celda hacia una vecina: -1, 0 o 1 en cada eje. */
export interface Ida {
  dx: number;
  dy: number;
}

const filaDe = (i: number, cols: number) => Math.floor(i / cols);
const colDe = (i: number, cols: number) => i % cols;

/** Una pieza quieta en su celda, sin animación. */
function piezaEn(id: number, color: number, celda: number, cols: number): PiezaVista {
  return { id, color, fila: filaDe(celda, cols), col: colDe(celda, cols), explota: false, mov: null, rechazo: 0 };
}

/** Las piezas del modelo tal cual, sin animar nada: cada celda con su pieza, cero de más y cero huecos. */
export function vistaDesdeModelo(celdas: readonly number[], ids: readonly number[], cols: number): PiezaVista[] {
  return celdas.map((color, i) => piezaEn(ids[i] as number, color, i, cols));
}

/**
 * Las piezas de un tablero recién repartido. Con `conEntrada` cada una cae desde arriba del tablero (un tablero
 * entero más arriba de su celda), columna por columna: la de la izquierda primero, con el escalón de su columna.
 */
export function vistaInicial(
  celdas: readonly number[],
  ids: readonly number[],
  cols: number,
  rows: number,
  conEntrada: boolean
): PiezaVista[] {
  return vistaDesdeModelo(celdas, ids, cols).map((p) =>
    conEntrada ? { ...p, entrada: { desde: p.fila - rows, retraso: retrasoDeColumna(p.col) } } : p
  );
}

/** Las dos piezas se deslizan a la celda de la otra. */
export function piezasTrasIntercambio(
  ps: readonly PiezaVista[],
  a: number,
  c: number,
  idsAntes: readonly number[],
  cols: number,
  nonce: number,
  asienta: boolean
): PiezaVista[] {
  const ida = idsAntes[a];
  const idc = idsAntes[c];
  const mov: Movimiento = { tipo: 'intercambio', filas: 0, asienta, nonce };
  return ps.map((p) => {
    if (p.id === ida) return { ...p, fila: filaDe(c, cols), col: colDe(c, cols), mov };
    if (p.id === idc) return { ...p, fila: filaDe(a, cols), col: colDe(a, cols), mov };
    return p;
  });
}

/** Las piezas que forman línea empiezan a estallar (siguen en la vista hasta que el paso se aplica). */
export function piezasMarcarExplota(ps: readonly PiezaVista[], idsQuitados: readonly number[]): PiezaVista[] {
  const quitar = new Set(idsQuitados);
  return ps.map((v) => (quitar.has(v.id) ? { ...v, explota: true } : v));
}

/**
 * La vista después de un paso: las quitadas se van, las que quedan bajan y las nuevas entran por arriba. Sale de
 * los ids del modelo (`idsDespues`): hay exactamente una pieza por celda y es la que el modelo dice.
 */
export function piezasTrasPaso(
  ps: readonly PiezaVista[],
  paso: Paso,
  idsDespues: readonly number[],
  cols: number,
  nonce: number
): PiezaVista[] {
  const porId = new Map(ps.map((p) => [p.id, p]));
  const desde = new Map(paso.nuevas.map((n) => [n.indice, n.desde]));
  return idsDespues.map((id, celda) => {
    const fila = filaDe(celda, cols);
    const col = colDe(celda, cols);
    const previa = porId.get(id);
    if (!previa) {
      const color = paso.tablero[celda] as number;
      return { ...piezaEn(id, color, celda, cols), entrada: { desde: desde.get(celda) ?? fila, retraso: retrasoDeColumna(col) } };
    }
    if (previa.fila === fila && previa.col === col) return previa;
    const mov: Movimiento = { tipo: 'caida', filas: fila - previa.fila, asienta: false, nonce };
    return { ...previa, fila, col, mov };
  });
}

/** La vista después de rebarajar: las piezas que cambian de celda se deslizan girando; las que sobran se van. */
export function piezasTrasRebaraje(
  ps: readonly PiezaVista[],
  despues: readonly number[],
  idsDespues: readonly number[],
  cols: number,
  nonce: number
): PiezaVista[] {
  const porId = new Map(ps.map((p) => [p.id, p]));
  return idsDespues.map((id, celda) => {
    const fila = filaDe(celda, cols);
    const col = colDe(celda, cols);
    const previa = porId.get(id);
    if (!previa) return { ...piezaEn(id, despues[celda] as number, celda, cols), entrada: { desde: fila, retraso: 0 } };
    if (previa.fila === fila && previa.col === col) return previa;
    const mov: Movimiento = { tipo: 'rebaraja', filas: 0, asienta: false, nonce };
    return { ...previa, fila, col, mov };
  });
}

/** El tablero del modelo en texto, una fila por renglón (un dígito por color): para los registros de depuración. */
export function volcarModelo(celdas: readonly number[], cols: number): string {
  const filas: string[] = [];
  for (let i = 0; i < celdas.length; i += cols) filas.push(celdas.slice(i, i + cols).map((v) => (v < 0 ? '.' : String(v))).join(''));
  return filas.join('/');
}

/** Lo mismo con lo que SE VE: `?` donde no hay pieza y `*` donde hay dos. Si coincide con el modelo, no hay desfase. */
export function volcarVista(ps: readonly PiezaVista[], cols: number, rows: number): string {
  const celdas: string[] = new Array<string>(cols * rows).fill('?');
  for (const p of ps) {
    const i = p.fila * cols + p.col;
    celdas[i] = celdas[i] === '?' ? String(p.color) : '*';
  }
  const filas: string[] = [];
  for (let f = 0; f < rows; f++) filas.push(celdas.slice(f * cols, (f + 1) * cols).join(''));
  return filas.join('/');
}

/**
 * Las invariantes de la vista en reposo contra el modelo; devuelve lo que falla (vacío = todo bien):
 * el modelo está lleno, hay exactamente filas × columnas piezas, cada celda tiene una sola y es la del modelo
 * (mismo id) y del color del modelo, y ninguna sigue estallando.
 */
export function invariantesVista(
  ps: readonly PiezaVista[],
  celdas: readonly number[],
  ids: readonly number[],
  cols: number,
  rows: number
): string[] {
  const fallas: string[] = [];
  const total = cols * rows;
  const vacias = celdas.filter((v) => v < 0).length;
  if (vacias > 0) fallas.push(`el modelo tiene ${vacias} celdas vacías en reposo`);
  if (celdas.length !== total || ids.length !== total) fallas.push(`el modelo no mide ${cols}×${rows}`);
  if (ps.length !== total) fallas.push(`hay ${ps.length} piezas visibles y el tablero pide ${total}`);
  const vistas = new Set<number>();
  for (const p of ps) {
    const celda = p.fila * cols + p.col;
    if (vistas.has(celda)) fallas.push(`dos piezas en la celda ${celda}`);
    vistas.add(celda);
    if (ids[celda] !== p.id) fallas.push(`celda ${celda}: se ve la pieza ${p.id} y el modelo dice ${String(ids[celda])}`);
    if (celdas[celda] !== p.color) fallas.push(`celda ${celda}: se ve el color ${p.color} y el modelo dice ${String(celdas[celda])}`);
    if (p.explota) fallas.push(`celda ${celda}: sigue estallando en reposo`);
  }
  for (let i = 0; i < total; i++) if (!vistas.has(i)) fallas.push(`celda ${i}: hueco, no hay pieza`);
  return fallas;
}
