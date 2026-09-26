/**
 * Lo puro de Colmena: dónde va cada ranura, dónde va cada hexágono del panal y qué fichas completan una frase.
 * No importa nada (se prueba con `npm run check:colmena`); los espacios y tamaños los pasa quien lo usa.
 */

export interface OpcionesRanuras {
  /** Espacio entre dos letras de una palabra, con la ranura de tamaño completo. */
  hueco: number;
  /** Espacio visible entre dos palabras. */
  entrePalabras: number;
  entreLineas: number;
  /** Ranura de tamaño completo (32 × 40) y la más chica a la que se encoge antes de partir una palabra. */
  anchoBase: number;
  altoBase: number;
  anchoMin: number;
}

export interface Ranura {
  x: number;
  y: number;
  /** 0-based: de qué palabra es y qué letra de esa palabra. */
  palabra: number;
  letra: number;
}

export interface DistribucionRanuras {
  ancho: number;
  alto: number;
  /** El tamaño que se usó: igual en todas las ranuras de la frase. */
  ranuraAncho: number;
  ranuraAlto: number;
  lineas: number;
  ranuras: Ranura[];
  /** Un renglón por palabra: donde empieza y cuánto mide. */
  palabras: { x: number; y: number; ancho: number }[];
  /** La palabra más larga no cupo ni con la ranura más chica. */
  desborda: boolean;
}

function anchoDePalabra(letras: number, w: number, hueco: number): number {
  return letras * w + Math.max(0, letras - 1) * hueco;
}

/**
 * Reparte las ranuras por palabra. Las palabras se acomodan de izquierda a derecha y saltan de línea solo
 * entre una y otra, nunca a media palabra; cada línea queda centrada. Si la palabra más larga no cabe con la
 * ranura completa, se encogen juntas todas las ranuras (y su hueco) hasta que quepa.
 */
export function distribuirRanuras(palabras: readonly number[], ancho: number, o: OpcionesRanuras): DistribucionRanuras {
  const mayor = palabras.reduce((m, n) => Math.max(m, n), 0);
  let w = o.anchoBase;
  let hueco = o.hueco;
  let desborda = false;
  if (mayor > 0) {
    for (; w > o.anchoMin; w--) {
      hueco = Math.max(1, Math.round((o.hueco * w) / o.anchoBase));
      if (anchoDePalabra(mayor, w, hueco) <= ancho) break;
    }
    hueco = Math.max(1, Math.round((o.hueco * w) / o.anchoBase));
    desborda = anchoDePalabra(mayor, w, hueco) > ancho;
  }
  const h = Math.round((o.altoBase * w) / o.anchoBase);

  const renglones: { palabras: number[]; ancho: number }[] = [];
  palabras.forEach((n, i) => {
    const ancha = anchoDePalabra(n, w, hueco);
    const actual = renglones[renglones.length - 1];
    if (actual && actual.ancho + o.entrePalabras + ancha <= ancho) {
      actual.palabras.push(i);
      actual.ancho += o.entrePalabras + ancha;
    } else {
      renglones.push({ palabras: [i], ancho: ancha });
    }
  });

  const ranuras: Ranura[] = [];
  const lugares: { x: number; y: number; ancho: number }[] = [];
  renglones.forEach((r, linea) => {
    const y = linea * (h + o.entreLineas);
    let x = Math.max(0, (ancho - r.ancho) / 2);
    for (const p of r.palabras) {
      const n = palabras[p] ?? 0;
      lugares[p] = { x, y, ancho: anchoDePalabra(n, w, hueco) };
      for (let l = 0; l < n; l++) ranuras.push({ x: x + l * (w + hueco), y, palabra: p, letra: l });
      x += anchoDePalabra(n, w, hueco) + o.entrePalabras;
    }
  });

  const lineas = renglones.length;
  return {
    ancho,
    alto: lineas > 0 ? lineas * h + (lineas - 1) * o.entreLineas : 0,
    ranuraAncho: w,
    ranuraAlto: h,
    lineas,
    ranuras,
    palabras: lugares,
    desborda,
  };
}

/** Lo que anuncia el lector de pantalla de una ranura: «Palabra 1 de 5, letra 3 de 5, vacía» o con su letra. */
export function etiquetaRanura(palabra: number, palabras: number, letra: number, letras: number, valor: string | null): string {
  return `Palabra ${palabra + 1} de ${palabras}, letra ${letra + 1} de ${letras}, ${valor ? valor : 'vacía'}`;
}

export interface OpcionesPanal {
  /** El área táctil mínima: es el alto de cada fila, y el ancho de la ficha nunca baja de ella. */
  toqueMin: number;
  /** Lo que se ve de hueco entre fichas vecinas. */
  hueco: number;
}

export interface Hexagono {
  x: number;
  y: number;
}

export interface DisposicionPanal {
  ancho: number;
  alto: number;
  /** El hexágono con punta arriba: ancho de cara a cara y alto de punta a punta. */
  hexAncho: number;
  hexAlto: number;
  /** Lo que hay de un centro al siguiente en la fila y de una fila a la otra. */
  pasoX: number;
  pasoY: number;
  columnas: number;
  filas: number;
  /** Donde va la esquina de cada hexágono, en el orden de las letras. */
  hexagonos: Hexagono[];
}

const RAIZ3_2 = Math.sqrt(3) / 2;

/**
 * El panal: filas de hexágonos con punta arriba, una fila sí y otra no desplazada medio hexágono, sobre una
 * retícula en la que ninguno se encima con su vecino. La fila mide `toqueMin` de alto, así que el área táctil
 * de cada ficha (su ancho por el alto de la fila) nunca baja de `toqueMin` por lado y no se traslapa con otra.
 */
export function disposicionPanal(cantidad: number, ancho: number, o: OpcionesPanal): DisposicionPanal {
  const pasoY = o.toqueMin;
  const pasoX = pasoY / RAIZ3_2;
  const hexAncho = pasoX - o.hueco;
  const hexAlto = hexAncho / RAIZ3_2;
  const maxColumnas = Math.max(2, Math.floor((ancho - hexAncho) / pasoX) + 1);
  const columnas = Math.min(maxColumnas, Math.max(3, Math.round(Math.sqrt(cantidad * 1.3))));

  // Fila par: `columnas` fichas; fila impar: una menos, corrida medio paso.
  const capacidad = (fila: number) => (fila % 2 === 0 ? columnas : columnas - 1);
  const cuentas: number[] = [];
  for (let restan = cantidad, fila = 0; restan > 0; fila++) {
    const n = Math.min(restan, capacidad(fila));
    cuentas.push(n);
    restan -= n;
  }

  const izquierda = Math.max(0, (ancho - ((columnas - 1) * pasoX + hexAncho)) / 2);
  const hexagonos: Hexagono[] = [];
  cuentas.forEach((n, fila) => {
    const base = izquierda + (fila % 2 === 0 ? 0 : pasoX / 2);
    // Una fila incompleta se centra dentro de la retícula, sin salirse de ella.
    const corrida = Math.floor((capacidad(fila) - n) / 2);
    for (let i = 0; i < n; i++) hexagonos.push({ x: base + (corrida + i) * pasoX, y: fila * pasoY });
  });

  const filas = cuentas.length;
  return {
    ancho,
    alto: filas > 0 ? (filas - 1) * pasoY + hexAlto : 0,
    hexAncho,
    hexAlto,
    pasoX,
    pasoY,
    columnas,
    filas,
    hexagonos,
  };
}

/** Qué lugar ocupa cada hexágono si se cuentan del centro hacia afuera (0 es el más cercano al centro). */
export function ordenDesdeCentro(hexagonos: readonly Hexagono[], hexAncho: number, hexAlto: number): number[] {
  if (hexagonos.length === 0) return [];
  const cx = hexagonos.reduce((s, h) => s + h.x + hexAncho / 2, 0) / hexagonos.length;
  const cy = hexagonos.reduce((s, h) => s + h.y + hexAlto / 2, 0) / hexagonos.length;
  const distancias = hexagonos.map((h, i) => ({ i, d: Math.hypot(h.x + hexAncho / 2 - cx, h.y + hexAlto / 2 - cy) }));
  const rango: number[] = new Array<number>(hexagonos.length).fill(0);
  [...distancias].sort((a, b) => a.d - b.d || a.i - b.i).forEach((e, r) => {
    rango[e.i] = r;
  });
  return rango;
}

/**
 * Las fichas que completan la frase desde la ranura `desde`: una por ranura que falta, la primera libre con esa
 * letra. Es lo que vuela en «No me sale» y cuando se acaba el tiempo. Solo dibuja: qué cuenta como armado lo
 * decide la pantalla, no esto.
 */
export function fichasParaCompletar(letras: readonly string[], usadas: readonly number[], objetivo: string, desde: number): number[] {
  const tomadas = new Set(usadas);
  const fichas: number[] = [];
  for (let k = desde; k < objetivo.length; k++) {
    const i = letras.findIndex((l, idx) => l === objetivo[k] && !tomadas.has(idx));
    if (i < 0) continue;
    tomadas.add(i);
    fichas.push(i);
  }
  return fichas;
}

/** Cuánto se espera para lanzar la ficha `i` de `n`: 40 ms entre una y otra, sin pasar de `tope` en total. */
export function retrasoVuelo(i: number, n: number, paso = 40, tope = 400): number {
  return Math.min(paso, tope / Math.max(1, n)) * i;
}
