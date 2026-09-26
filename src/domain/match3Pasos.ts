/**
 * La resolución de una jugada de Dulces PASO A PASO, para animarla.
 *
 * `resolve` (match3.ts) deja el tablero terminado de golpe, y eso no se puede animar: no dice qué piezas se
 * quitaron en cada vuelta, cuáles bajaron ni cuáles entraron. Esto corre exactamente el mismo ciclo
 * (`findMatches` → quitar → `collapse` → `refill`, con el mismo tope de veinte vueltas) y además anota cada
 * paso. Llama a las mismas funciones del dominio en el mismo orden, así que gasta el azar igual que `resolve`:
 * con la misma semilla deja el mismo tablero, el mismo `porColor`, el mismo `total` y las mismas `cascadas`
 * (`npm run check:dulces` compara los dos caminos). No decide nada nuevo: solo cuenta lo que ya pasaba.
 */
import { VACIA, collapse, findMatches, refill, type Board, type Rand, type Resolucion } from './match3';

/** Una pieza que baja por su columna: de la celda `desde` a la celda `hasta` (más abajo). */
export interface Caida {
  desde: number;
  hasta: number;
}

/** Una pieza que entra por arriba del tablero y cae hasta su celda. */
export interface Nueva {
  indice: number;
  color: number;
  /** La fila de donde empieza a caer: negativa, sobre el borde de arriba del tablero. */
  desde: number;
}

/** Una vuelta del ciclo. */
export interface Paso {
  /** Las celdas que forman línea y se quitan, con el color que tenían. */
  quitar: number[];
  colores: number[];
  /** Cuántas piezas de cada color se quitan en este paso. */
  porColor: Record<number, number>;
  /** Las que quedan bajan a llenar los huecos. */
  caidas: Caida[];
  /** Las que entran a llenar lo que queda vacío arriba. */
  nuevas: Nueva[];
  /** El tablero al terminar este paso. */
  tablero: number[];
}

export interface ResolucionPasos extends Resolucion {
  pasos: Paso[];
}

/** De qué celda a qué celda baja cada pieza al hacer `collapse`: se calcula antes de aplicarlo. */
function caidasDeColapso(b: Board): Caida[] {
  const caidas: Caida[] = [];
  for (let c = 0; c < b.cols; c++) {
    let escribe = b.rows - 1;
    for (let f = b.rows - 1; f >= 0; f--) {
      if (b.cells[f * b.cols + c] !== VACIA) {
        if (escribe !== f) caidas.push({ desde: f * b.cols + c, hasta: escribe * b.cols + c });
        escribe--;
      }
    }
  }
  return caidas;
}

/**
 * Igual que `resolve`, pero devuelve además cada paso. Muta el tablero hasta dejarlo terminado, como `resolve`.
 */
export function resolverPorPasos(b: Board, colores: number, rand: Rand = Math.random): ResolucionPasos {
  const porColor: Record<number, number> = {};
  const pasos: Paso[] = [];
  let total = 0;

  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const linea = findMatches(b);
    if (linea.length === 0) break;

    const quitar: number[] = [];
    const quitados: number[] = [];
    const delPaso: Record<number, number> = {};
    for (const i of linea) {
      const col = b.cells[i];
      if (col !== undefined && col !== VACIA) {
        porColor[col] = (porColor[col] ?? 0) + 1;
        delPaso[col] = (delPaso[col] ?? 0) + 1;
        total++;
        quitar.push(i);
        quitados.push(col);
      }
      b.cells[i] = VACIA;
    }

    const caidas = caidasDeColapso(b);
    collapse(b);

    const vacios: number[] = [];
    const vaciosPorColumna: number[] = new Array<number>(b.cols).fill(0);
    for (let i = 0; i < b.cells.length; i++) {
      if (b.cells[i] === VACIA) {
        vacios.push(i);
        vaciosPorColumna[i % b.cols] = (vaciosPorColumna[i % b.cols] ?? 0) + 1;
      }
    }
    refill(b, colores, rand);

    // Las nuevas de una columna ocupan sus filas de arriba y caen todas la misma distancia: las que se
    // quitaron de esa columna.
    const nuevas: Nueva[] = vacios.map((indice) => ({
      indice,
      color: b.cells[indice] as number,
      desde: Math.floor(indice / b.cols) - (vaciosPorColumna[indice % b.cols] ?? 0),
    }));

    pasos.push({ quitar, colores: quitados, porColor: delPaso, caidas, nuevas, tablero: [...b.cells] });
  }

  return { porColor, total, cascadas: pasos.length, pasos };
}

/** Sin pieza: el id de una celda vacía mientras se reacomoda. */
export const SIN_ID = -1;

/**
 * Los ids de las piezas del tablero después de un paso: las quitadas desaparecen, las que caen conservan el
 * suyo en su celda nueva y las que entran reciben uno nuevo de `nuevoId`. Así cada pieza se puede animar
 * como la misma pieza de principio a fin (con un id estable), en vez de recrearla al cambiar de celda.
 */
export function idsTrasPaso(ids: readonly number[], paso: Paso, nuevoId: () => number): number[] {
  const sig = [...ids];
  for (const i of paso.quitar) sig[i] = SIN_ID;
  const moviendo = paso.caidas.map((c) => ({ hasta: c.hasta, id: ids[c.desde] ?? SIN_ID }));
  for (const c of paso.caidas) sig[c.desde] = SIN_ID;
  for (const m of moviendo) sig[m.hasta] = m.id;
  for (const n of paso.nuevas) sig[n.indice] = nuevoId();
  return sig;
}
