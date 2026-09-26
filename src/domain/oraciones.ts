import type { Trozo } from './lectura';

/**
 * Las oraciones de un capítulo y cuándo suena cada una. Lo puro de la lectura acompañada: se prueba con
 * `npm run check:lecturas` sobre los 29 capítulos reales.
 *
 * El texto de un capítulo se parte en oraciones con su posición exacta (`inicio` y `fin` son índices del texto del
 * capítulo, así que `texto.slice(inicio, fin)` devuelve la oración). Cuándo empieza cada una sale de las marcas de
 * oración de Polly si existen y, si no, de una estimación proporcional a los caracteres sobre la duración real:
 * nunca falla por falta de marcas.
 */

export interface Oracion {
  /** La oración tal cual está en el texto, sin el espacio ni el salto que la separa de la siguiente. */
  texto: string;
  /** Índice de su primer carácter en el texto del capítulo. */
  inicio: number;
  /** Índice después de su último carácter. */
  fin: number;
  /** Número de párrafo (los párrafos se separan con una línea en blanco), desde 0. */
  parrafo: number;
}

/** Marcas de oración de Polly de un capítulo: la hora de cada una y dónde está en el texto que se le mandó. */
export interface MarcasOraciones {
  /** Cuántos caracteres tenía el texto que se mandó a Polly: si no coincide con el del capítulo, no se usan. */
  n: number;
  /** `[milisegundos, inicio, fin]` de cada oración de Polly, con `inicio` y `fin` en caracteres de ese texto. */
  s: [number, number, number][];
}

/** Palabras que terminan en punto sin cerrar una oración («Mr. Smith»). */
const ABREVIATURAS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'vs', 'etc', 'jr', 'sr', 'sra']);

/** Un signo que cierra oración, con las comillas o el paréntesis que lo siguen, antes de un espacio o del final. */
const CIERRE = /[.?!…]+["'”’)\]]*(?=\s|$)/g;

function partirParrafo(p: string, base: number, parrafo: number): Oracion[] {
  const salida: Oracion[] = [];
  let ini = 0;
  const poner = (fin: number) => {
    const texto = p.slice(ini, fin).trimEnd();
    if (texto.length > 0) salida.push({ texto, inicio: base + ini, fin: base + ini + texto.length, parrafo });
  };
  CIERRE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CIERRE.exec(p))) {
    const fin = m.index + m[0].length;
    const resto = p.slice(fin);
    const siguiente = resto.match(/^\s*(\S)/);
    if (siguiente) {
      // Lo que sigue en minúscula es la acotación de un diálogo («…?» says Don Beto): la oración no terminó.
      if (/[a-z]/.test(siguiente[1] as string)) continue;
      const palabra = p.slice(0, m.index).match(/([A-Za-z]+)$/)?.[1]?.toLowerCase();
      if (m[0][0] === '.' && palabra && ABREVIATURAS.has(palabra)) continue;
    }
    poner(fin);
    ini = fin + (resto.length - resto.trimStart().length);
  }
  poner(p.length);
  return salida;
}

/** Parte el texto de un capítulo en oraciones, en orden, con su posición en el texto. */
export function dividirOraciones(texto: string): Oracion[] {
  const salida: Oracion[] = [];
  const separador = /\n\s*\n/g;
  let desde = 0;
  let parrafo = 0;
  let m: RegExpExecArray | null;
  const parrafos: [string, number][] = [];
  while ((m = separador.exec(texto))) {
    parrafos.push([texto.slice(desde, m.index), desde]);
    desde = m.index + m[0].length;
  }
  parrafos.push([texto.slice(desde), desde]);
  for (const [p, base] of parrafos) {
    const oraciones = partirParrafo(p, base, parrafo);
    if (oraciones.length > 0) {
      salida.push(...oraciones);
      parrafo++;
    }
  }
  return salida;
}

/** El instante (s) en que empieza cada oración, proporcional a los caracteres de cada una sobre la duración real. */
export function inicioEstimado(oraciones: readonly Oracion[], duracion: number): number[] {
  const total = oraciones.reduce((s, o) => s + o.texto.length, 0);
  const d = Number.isFinite(duracion) && duracion > 0 ? duracion : 0;
  let acumulado = 0;
  return oraciones.map((o) => {
    const t = total === 0 ? 0 : (d * acumulado) / total;
    acumulado += o.texto.length;
    return t;
  });
}

function marcasValidas(marcas: MarcasOraciones | undefined, longitudTexto: number): marcas is MarcasOraciones {
  if (!marcas || marcas.n !== longitudTexto || !Array.isArray(marcas.s) || marcas.s.length === 0) return false;
  let antes = -1;
  for (const m of marcas.s) {
    if (!Array.isArray(m) || m.length !== 3 || !m.every(Number.isFinite) || m[1] >= m[2] || m[0] < antes) return false;
    antes = m[0];
  }
  return true;
}

/**
 * El instante (s) en que empieza cada oración según las marcas de Polly, o null si no sirven (no hay, o son de otro
 * texto). Una oración que empieza dentro de una marca (Polly junta lo que aquí son dos) se coloca por su posición
 * dentro de ella, entre esa marca y la siguiente. Nunca retrocede ni pasa de la duración.
 */
export function inicioDeMarcas(
  oraciones: readonly Oracion[],
  marcas: MarcasOraciones | undefined,
  longitudTexto: number,
  duracion: number
): number[] | null {
  if (!marcasValidas(marcas, longitudTexto)) return null;
  const { s } = marcas;
  const tope = Number.isFinite(duracion) && duracion > 0 ? duracion : Infinity;
  let anterior = 0;
  return oraciones.map((o) => {
    let k = 0;
    for (let i = 0; i < s.length; i++) if ((s[i] as number[])[1]! <= o.inicio) k = i;
    const [ms, ini, fin] = s[k] as [number, number, number];
    const t0 = ms / 1000;
    const siguiente = s[k + 1] ? (s[k + 1] as number[])[0]! / 1000 : Math.min(tope, t0);
    const fraccion = Math.min(1, Math.max(0, (o.inicio - ini) / (fin - ini)));
    const t = Math.min(tope, Math.max(anterior, t0 + fraccion * Math.max(0, siguiente - t0)));
    anterior = t;
    return t;
  });
}

/** La oración que suena en `pos` (s): la última que ya empezó. Antes de la primera, la primera. */
export function indiceEn(inicios: readonly number[], pos: number): number {
  'worklet';
  let lo = 0;
  let hi = inicios.length - 1;
  while (lo < hi) {
    const medio = (lo + hi + 1) >> 1;
    if ((inicios[medio] as number) <= pos) lo = medio;
    else hi = medio - 1;
  }
  return lo;
}

/**
 * Reparte los trozos del capítulo (`partirTexto`) entre sus oraciones. Un trozo que cruza el límite de dos oraciones
 * (una frase del catálogo con un punto en medio) se parte en dos, y las dos mitades conservan su `entryId`.
 */
export function trozosPorOracion(oraciones: readonly Oracion[], trozos: readonly Trozo[]): Trozo[][] {
  let pos = 0;
  const rangos = trozos.map((t) => {
    const r = { ini: pos, fin: pos + t.texto.length, t };
    pos = r.fin;
    return r;
  });
  return oraciones.map((o) => {
    const salida: Trozo[] = [];
    for (const r of rangos) {
      if (r.fin <= o.inicio) continue;
      if (r.ini >= o.fin) break;
      salida.push({ ...r.t, texto: r.t.texto.slice(Math.max(r.ini, o.inicio) - r.ini, Math.min(r.fin, o.fin) - r.ini) });
    }
    return salida;
  });
}
