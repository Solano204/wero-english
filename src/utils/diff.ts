/**
 * La transformación de una frase incorrecta en la correcta, por palabra y por letra. Sirve para «En qué te vas a
 * equivocar»: las palabras iguales se quedan en su lugar y solo lo que cambia sale o entra. Módulo puro: se prueba
 * con `npm run check:gramatica` sobre los 80 temas reales.
 *
 * Primero se alinean las palabras (subsecuencia común más larga, sin mayúsculas ni acentos). Entre dos palabras
 * iguales queda un tramo de cambio: ahí se emparejan las palabras que se parecen (misma palabra con otras letras:
 * «work» y «works») y se compara letra por letra; las que no se parecen (`is` y `are`) una sale y la otra entra.
 */

/** Un trozo de una palabra que cambia: igual, o letras que salen (solo en la incorrecta) o entran (solo en la correcta). */
export interface Parte {
  texto: string;
  tipo: 'igual' | 'sale' | 'entra';
}

/** Un elemento de la frase, en orden. Las piezas `sale` solo existen en la incorrecta y las `entra` en la correcta. */
export type Pieza =
  | { tipo: 'igual'; texto: string }
  | { tipo: 'letras'; partes: Parte[] }
  | { tipo: 'sale'; texto: string }
  | { tipo: 'entra'; texto: string };

export interface DiffFrase {
  piezas: Pieza[];
  /** Cuántas palabras de la frase más larga se conservan (iguales o solo con otras letras), de 0 a 1. */
  compartidas: number;
  /** Cuántos grupos seguidos de piezas cambian. */
  tramos: number;
  /** Si el cambio se lee bien como transformación; si no, conviene mostrar las dos frases con un fundido. */
  claro: boolean;
}

/** Dos palabras se emparejan (mismas letras con cambios) si comparten al menos esto de sus letras (Dice, de 0 a 1). */
export const UMBRAL_PALABRA = 0.6;
/** Una transformación se lee bien si se conserva al menos esta parte de las palabras... */
export const MIN_COMPARTIDAS = 0.5;
/** ...y no hay más de estos tramos de cambio. */
export const MAX_TRAMOS = 3;

/** La forma comparable de una letra o palabra: sin mayúsculas ni acentos y con un solo apóstrofo. */
function clave(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");
}

/** La forma comparable de una palabra: además, sin la puntuación pegada. */
function clavePalabra(palabra: string): string {
  return clave(palabra).replace(/[^\p{L}\p{N}']/gu, '');
}

/** Índices (i, j) de la subsecuencia común más larga de dos listas, según `igual`. */
function subsecuencia<A, B>(a: readonly A[], b: readonly B[], igual: (x: A, y: B) => boolean): [number, number][] {
  const ancho = b.length + 1;
  const dp = new Array<number>((a.length + 1) * ancho).fill(0);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i * ancho + j] = igual(a[i] as A, b[j] as B)
        ? (dp[(i + 1) * ancho + j + 1] ?? 0) + 1
        : Math.max(dp[(i + 1) * ancho + j] ?? 0, dp[i * ancho + j + 1] ?? 0);
    }
  }
  const pares: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (igual(a[i] as A, b[j] as B)) {
      pares.push([i, j]);
      i++;
      j++;
    } else if ((dp[(i + 1) * ancho + j] ?? 0) >= (dp[i * ancho + j + 1] ?? 0)) i++;
    else j++;
  }
  return pares;
}

/** Qué tanto se parecen dos palabras por sus letras en orden (Dice sobre la subsecuencia común), de 0 a 1. */
function parecido(a: string, b: string): number {
  const x = Array.from(clavePalabra(a));
  const y = Array.from(clavePalabra(b));
  if (x.length + y.length === 0) return 1;
  return (2 * subsecuencia(x, y, (p, q) => p === q).length) / (x.length + y.length);
}

function anota(partes: Parte[], texto: string, tipo: Parte['tipo']): void {
  const ultima = partes[partes.length - 1];
  if (ultima && ultima.tipo === tipo) partes[partes.length - 1] = { texto: ultima.texto + texto, tipo };
  else partes.push({ texto, tipo });
}

/** La misma palabra con otras letras: lo que se conserva, lo que sale (solo en `mal`) y lo que entra (solo en `bien`). */
function diffLetras(mal: string, bien: string): Parte[] {
  const a = Array.from(mal);
  const b = Array.from(bien);
  const pares = subsecuencia(a, b, (x, y) => clave(x) === clave(y));
  const partes: Parte[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pares, [a.length, b.length] as [number, number]]) {
    // Antes de cada letra en común primero salen las que sobran y luego entran las nuevas.
    if (pi > i) anota(partes, a.slice(i, pi).join(''), 'sale');
    if (pj > j) anota(partes, b.slice(j, pj).join(''), 'entra');
    if (pi < a.length) anota(partes, b[pj] ?? '', 'igual');
    i = pi + 1;
    j = pj + 1;
  }
  return partes;
}

function palabrasDe(frase: string): string[] {
  return frase.split(/\s+/).filter((p) => p.length > 0);
}

/** Alinea la frase incorrecta con la correcta. Ver el encabezado del módulo. */
export function diffFrase(mal: string, bien: string): DiffFrase {
  const a = palabrasDe(mal);
  const b = palabrasDe(bien);
  const iguales = subsecuencia(a, b, (x, y) => clavePalabra(x) === clavePalabra(y));

  const piezas: Pieza[] = [];
  let conservadas = 0;
  let ia = 0;
  let ib = 0;
  for (const [i, j] of [...iguales, [a.length, b.length] as [number, number]]) {
    // El tramo de cambio entre dos palabras iguales: se emparejan las que se parecen y el resto sale o entra.
    const sobran = a.slice(ia, i);
    const nuevas = b.slice(ib, j);
    const pares = subsecuencia(sobran, nuevas, (x, y) => parecido(x, y) >= UMBRAL_PALABRA);
    let pa = 0;
    let pb = 0;
    for (const [qa, qb] of [...pares, [sobran.length, nuevas.length] as [number, number]]) {
      for (; pa < qa; pa++) piezas.push({ tipo: 'sale', texto: sobran[pa] as string });
      for (; pb < qb; pb++) piezas.push({ tipo: 'entra', texto: nuevas[pb] as string });
      if (qa < sobran.length && qb < nuevas.length) {
        piezas.push({ tipo: 'letras', partes: diffLetras(sobran[qa] as string, nuevas[qb] as string) });
        conservadas++;
        pa = qa + 1;
        pb = qb + 1;
      }
    }
    if (i < a.length) {
      piezas.push({ tipo: 'igual', texto: b[j] as string });
      conservadas++;
    }
    ia = i + 1;
    ib = j + 1;
  }

  let tramos = 0;
  let enCambio = false;
  for (const p of piezas) {
    const cambia = p.tipo !== 'igual';
    if (cambia && !enCambio) tramos++;
    enCambio = cambia;
  }
  const mayor = Math.max(a.length, b.length);
  const compartidas = mayor === 0 ? 1 : conservadas / mayor;
  return { piezas, compartidas, tramos, claro: compartidas >= MIN_COMPARTIDAS && tramos <= MAX_TRAMOS };
}
