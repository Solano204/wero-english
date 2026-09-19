/**
 * Motor de tres en línea.
 *
 * Es lógica pura sobre un arreglo de números: no sabe de React, ni de
 * colores, ni de inglés. Así se puede probar entera desde node y la
 * pantalla queda como una vista tonta encima.
 *
 * El tablero se guarda plano, no como arreglo de arreglos. Con cascadas
 * se recorre el tablero muchas veces por jugada y un arreglo plano
 * evita cientos de accesos anidados en teléfonos lentos.
 */

export interface Board {
  cols: number;
  rows: number;
  /** Color por celda, o VACIA. Índice = fila * cols + columna. */
  cells: number[];
}

export const VACIA = -1;

/** Mínimo de piezas en línea para que cuente. */
export const MINIMO = 3;

export type Rand = () => number;

export function idx(b: Board, fila: number, col: number): number {
  return fila * b.cols + col;
}

export function enTablero(b: Board, fila: number, col: number): boolean {
  return fila >= 0 && fila < b.rows && col >= 0 && col < b.cols;
}

export function clone(b: Board): Board {
  return { cols: b.cols, rows: b.rows, cells: [...b.cells] };
}

/**
 * Crea un tablero sin combinaciones ya hechas.
 *
 * Si se llena al azar y luego se resuelve, el usuario ve el tablero
 * explotar solo al entrar y se siente que el juego se jugó a sí mismo.
 * Por eso se elige color a color evitando el tercero en línea.
 */
export function createBoard(
  cols: number,
  rows: number,
  colores: number,
  rand: Rand = Math.random
): Board {
  const b: Board = { cols, rows, cells: new Array(cols * rows).fill(VACIA) };

  for (let f = 0; f < rows; f++) {
    for (let c = 0; c < cols; c++) {
      const prohibidos = new Set<number>();

      const izq1 = enTablero(b, f, c - 1) ? b.cells[idx(b, f, c - 1)] ?? VACIA : VACIA;
      const izq2 = enTablero(b, f, c - 2) ? b.cells[idx(b, f, c - 2)] ?? VACIA : VACIA;
      if (izq1 !== VACIA && izq1 === izq2) prohibidos.add(izq1);

      const arr1 = enTablero(b, f - 1, c) ? b.cells[idx(b, f - 1, c)] ?? VACIA : VACIA;
      const arr2 = enTablero(b, f - 2, c) ? b.cells[idx(b, f - 2, c)] ?? VACIA : VACIA;
      if (arr1 !== VACIA && arr1 === arr2) prohibidos.add(arr1);

      const opciones: number[] = [];
      for (let k = 0; k < colores; k++) {
        if (!prohibidos.has(k)) opciones.push(k);
      }
      const elegido =
        opciones[Math.floor(rand() * opciones.length)] ?? 0;
      b.cells[idx(b, f, c)] = elegido;
    }
  }

  return b;
}

/** Índices de todas las celdas que forman parte de una línea. */
export function findMatches(b: Board): number[] {
  const marcadas = new Set<number>();

  // Horizontales
  for (let f = 0; f < b.rows; f++) {
    let inicio = 0;
    for (let c = 1; c <= b.cols; c++) {
      const actual = c < b.cols ? b.cells[idx(b, f, c)] : VACIA;
      const previo = b.cells[idx(b, f, inicio)];
      if (actual !== previo || actual === VACIA || c === b.cols) {
        const largo = c - inicio;
        if (largo >= MINIMO && previo !== VACIA) {
          for (let k = inicio; k < c; k++) marcadas.add(idx(b, f, k));
        }
        inicio = c;
      }
    }
  }

  // Verticales
  for (let c = 0; c < b.cols; c++) {
    let inicio = 0;
    for (let f = 1; f <= b.rows; f++) {
      const actual = f < b.rows ? b.cells[idx(b, f, c)] : VACIA;
      const previo = b.cells[idx(b, inicio, c)];
      if (actual !== previo || actual === VACIA || f === b.rows) {
        const largo = f - inicio;
        if (largo >= MINIMO && previo !== VACIA) {
          for (let k = inicio; k < f; k++) marcadas.add(idx(b, k, c));
        }
        inicio = f;
      }
    }
  }

  return [...marcadas];
}

/** Baja las piezas para llenar los huecos. Muta el tablero recibido. */
export function collapse(b: Board): void {
  for (let c = 0; c < b.cols; c++) {
    let escribe = b.rows - 1;
    for (let f = b.rows - 1; f >= 0; f--) {
      const v = b.cells[idx(b, f, c)];
      if (v !== VACIA) {
        b.cells[idx(b, escribe, c)] = v as number;
        if (escribe !== f) b.cells[idx(b, f, c)] = VACIA;
        escribe--;
      }
    }
    for (let f = escribe; f >= 0; f--) b.cells[idx(b, f, c)] = VACIA;
  }
}

/** Llena los huecos de arriba con piezas nuevas. Muta. */
export function refill(b: Board, colores: number, rand: Rand = Math.random): void {
  for (let i = 0; i < b.cells.length; i++) {
    if (b.cells[i] === VACIA) {
      b.cells[i] = Math.floor(rand() * colores);
    }
  }
}

export interface Resolucion {
  /** Cuántas piezas se quitaron de cada color. */
  porColor: Record<number, number>;
  total: number;
  /** Cuántas veces encadenó sin que el usuario tocara nada. */
  cascadas: number;
}

/**
 * Resuelve el tablero hasta que ya no queden líneas.
 *
 * El tope de veinte vueltas no es paranoia: con mala suerte en el
 * relleno una cascada puede encadenar mucho, y en un teléfono lento un
 * bucle sin tope congela la pantalla sin que el usuario sepa por qué.
 */
export function resolve(
  b: Board,
  colores: number,
  rand: Rand = Math.random
): Resolucion {
  const porColor: Record<number, number> = {};
  let total = 0;
  let cascadas = 0;

  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const linea = findMatches(b);
    if (linea.length === 0) break;

    for (const i of linea) {
      const col = b.cells[i];
      if (col !== undefined && col !== VACIA) {
        porColor[col] = (porColor[col] ?? 0) + 1;
        total++;
      }
      b.cells[i] = VACIA;
    }

    collapse(b);
    refill(b, colores, rand);
    cascadas++;
  }

  return { porColor, total, cascadas };
}

export function sonVecinas(b: Board, a: number, c: number): boolean {
  const fa = Math.floor(a / b.cols);
  const ca = a % b.cols;
  const fc = Math.floor(c / b.cols);
  const cc = c % b.cols;
  return Math.abs(fa - fc) + Math.abs(ca - cc) === 1;
}

export function swap(b: Board, a: number, c: number): void {
  const t = b.cells[a] as number;
  b.cells[a] = b.cells[c] as number;
  b.cells[c] = t;
}

/**
 * ¿El intercambio produce al menos una línea?
 *
 * Se prueba sobre una copia. Un intercambio que no arma nada se
 * devuelve con una animación de rebote en vez de gastarle una jugada al
 * usuario: cobrar por un movimiento imposible es la forma más rápida de
 * que cierre el juego.
 */
export function intercambioValido(b: Board, a: number, c: number): boolean {
  if (!sonVecinas(b, a, c)) return false;
  const copia = clone(b);
  swap(copia, a, c);
  return findMatches(copia).length > 0;
}

/** ¿Queda algún movimiento posible? Si no, hay que rebarajar. */
export function hayMovimiento(b: Board): boolean {
  for (let f = 0; f < b.rows; f++) {
    for (let c = 0; c < b.cols; c++) {
      const i = idx(b, f, c);
      if (c + 1 < b.cols && intercambioValido(b, i, idx(b, f, c + 1))) {
        return true;
      }
      if (f + 1 < b.rows && intercambioValido(b, i, idx(b, f + 1, c))) {
        return true;
      }
    }
  }
  return false;
}

/** Rebaraja conservando las piezas. Se usa cuando no queda movimiento. */
export function rebarajar(
  b: Board,
  colores: number,
  rand: Rand = Math.random
): void {
  for (let intento = 0; intento < 30; intento++) {
    for (let i = b.cells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = b.cells[i] as number;
      b.cells[i] = b.cells[j] as number;
      b.cells[j] = t;
    }
    if (findMatches(b).length === 0 && hayMovimiento(b)) return;
  }
  // Treinta intentos sin suerte: se arma uno nuevo y ya.
  const fresco = createBoard(b.cols, b.rows, colores, rand);
  b.cells = fresco.cells;
}
