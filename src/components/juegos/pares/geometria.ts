/**
 * La geometría del tablero de Pares: cuántas columnas caben, dónde queda cada ficha y
 * cuál está bajo un dedo. Módulo puro (`npm run check:pares`): no toca la pantalla ni
 * el dominio (`domain/pares.ts` sigue armando y mezclando el tablero). Las fichas se
 * colocan en posiciones absolutas calculadas aquí, así el cable (Skia, en el hilo de UI)
 * sabe dónde está cada una sin medir nada.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Una ficha nunca baja de 72 dp de alto (área táctil y tres renglones de texto). */
export const ALTO_FICHA_MIN = 72;
/** Y cuando sobra espacio no se estira más de esto: una ficha altísima se lee como un botón, no como una ficha. */
export const ALTO_FICHA_MAX = 104;
/** Hueco entre fichas, de la escala 4/8. */
export const HUECO_FICHAS = 8;

export interface Distribucion {
  columnas: number;
  filas: number;
  anchoFicha: number;
  altoFicha: number;
  /** Alto de todas las filas juntas. */
  altoContenido: number;
  /** Con las fichas en su mínimo de 72 aún no caben: el tablero scrollea. */
  desborda: boolean;
  /** Una por ficha, en el orden del tablero (lectura: de izquierda a derecha y de arriba abajo). */
  rectas: Rect[];
}

/**
 * 2 columnas si con fichas de 72 caben todas las filas; si no, 3. Con 4 pares (8 fichas)
 * caben 2 columnas en casi cualquier teléfono; con 5 a 8 pares hacen falta 3 en uno de 640 dp.
 */
export function columnasPara(fichas: number, disponible: number, hueco: number = HUECO_FICHAS): 2 | 3 {
  const filas = Math.ceil(fichas / 2);
  const altoConMinimo = filas * ALTO_FICHA_MIN + Math.max(0, filas - 1) * hueco;
  return altoConMinimo <= disponible ? 2 : 3;
}

/** Reparte las fichas en el espacio disponible: las llena a lo alto sin bajar de 72 ni pasar de 104. */
export function distribuir(fichas: number, ancho: number, disponible: number, hueco: number = HUECO_FICHAS): Distribucion {
  const columnas = columnasPara(fichas, disponible, hueco);
  const filas = Math.max(1, Math.ceil(fichas / columnas));
  const anchoFicha = Math.max(0, (ancho - hueco * (columnas - 1)) / columnas);
  const ideal = Math.floor((disponible - hueco * (filas - 1)) / filas);
  const altoFicha = Math.min(ALTO_FICHA_MAX, Math.max(ALTO_FICHA_MIN, Number.isFinite(ideal) ? ideal : ALTO_FICHA_MIN));
  const altoContenido = filas * altoFicha + (filas - 1) * hueco;
  const rectas: Rect[] = [];
  for (let i = 0; i < fichas; i++) {
    const columna = i % columnas;
    const fila = Math.floor(i / columnas);
    rectas.push({
      x: columna * (anchoFicha + hueco),
      y: fila * (altoFicha + hueco),
      width: anchoFicha,
      height: altoFicha,
    });
  }
  return { columnas, filas, anchoFicha, altoFicha, altoContenido, desborda: altoContenido > disponible, rectas };
}

/** El índice de la ficha bajo el punto (x, y), o -1 si el dedo está en un hueco o fuera. */
export function fichaEn(rectas: readonly Rect[], x: number, y: number): number {
  for (let i = 0; i < rectas.length; i++) {
    const r = rectas[i];
    if (r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return i;
  }
  return -1;
}

/** El centro de una ficha: de ahí sale y a ahí llega el cable. */
export function centroDe(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
