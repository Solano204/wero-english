/**
 * Posiciones de las vocales en el trapecio del IPA, para el mapa de la boca del laboratorio de sonidos.
 *
 * Fuentes:
 *  - Las vocales inglesas: el gráfico de vocales de la Asociación Fonética Internacional (The International
 *    Phonetic Alphabet, revisión 2020), donde cada símbolo tiene su lugar según qué tan cerrada (altura de la
 *    lengua) y qué tan posterior (dónde queda la lengua) es la vocal. /ɚ/ y /ɝ/ son /ə/ y /ɜ/ con el diacrítico de
 *    r (rótico): ocupan el mismo lugar.
 *  - Las vocales del español, /i e a o u/: Martínez-Celdrán, Fernández-Planas y Carrera-Sabaté (2003), «Castilian
 *    Spanish», Journal of the International Phonetic Association 33(2), 255-259, que las sitúa en el mismo gráfico.
 *
 * Las alturas son las del gráfico: cerrada 0, casi cerrada 1/6, media-cerrada 1/3, media 1/2, media-abierta 2/3,
 * casi abierta 5/6 y abierta 1. La posterioridad va de anterior (0) a posterior (1), con central en 0.5. Los
 * diptongos y las vocales seguidas de r (/ɑr/, /ɛr/, /ɪr/, /ɔr/) no son un punto del gráfico: no están en la tabla.
 *
 * Módulo puro: sin React ni datos, así se prueba con `npm run check:sonidos`.
 */

export interface PosicionVocal {
  /** 0 anterior, 0.5 central, 1 posterior. */
  atras: number;
  /** 0 cerrada, 1 abierta. */
  abierta: number;
}

/** Cuánto se corre el borde izquierdo del trapecio hacia la derecha en la parte de abajo (el derecho es vertical). */
export const INCLINACION = 0.3;
/** Alto del trapecio respecto de su ancho, como en el gráfico. */
export const PROPORCION = 0.6;
/** Diferencia de distancia por debajo de la cual una vocal está «a medio camino» de dos del español. */
const EMPATE = 0.02;
/** Distancia por debajo de la cual una vocal cae «en el mismo lugar» que una del español. */
const MISMO_LUGAR = 0.03;

/** Las vocales inglesas del mapa, por su símbolo sin barras. */
const VOCALES: Record<string, PosicionVocal> = {
  'iː': { atras: 0, abierta: 0 },
  'ɪ': { atras: 0.25, abierta: 1 / 6 },
  'ɛ': { atras: 0, abierta: 2 / 3 },
  'æ': { atras: 0, abierta: 5 / 6 },
  'ɑː': { atras: 1, abierta: 1 },
  'ɒ': { atras: 1, abierta: 1 },
  'ɔː': { atras: 1, abierta: 2 / 3 },
  'ʊ': { atras: 0.75, abierta: 1 / 6 },
  'uː': { atras: 1, abierta: 0 },
  'ʌ': { atras: 1, abierta: 2 / 3 },
  'ɜː': { atras: 0.5, abierta: 2 / 3 },
  'ə': { atras: 0.5, abierta: 0.5 },
  'ɚ': { atras: 0.5, abierta: 0.5 },
  'ɝ': { atras: 0.5, abierta: 2 / 3 },
};

export type VocalEs = 'i' | 'e' | 'a' | 'o' | 'u';

/** Las cinco vocales del español, en el orden en que se nombran. */
export const ORDEN_ES: readonly VocalEs[] = ['i', 'e', 'a', 'o', 'u'];

export const VOCALES_ES: Record<VocalEs, PosicionVocal> = {
  i: { atras: 0, abierta: 0 },
  e: { atras: 0, abierta: 1 / 3 },
  a: { atras: 0, abierta: 1 },
  o: { atras: 1, abierta: 1 / 3 },
  u: { atras: 1, abierta: 0 },
};

/** El símbolo IPA sin las barras que lo encierran: `/ɪ/` da `ɪ`. Solo para dibujarlo. */
export function sinBarras(ipa: string): string {
  return ipa.replace(/^\//, '').replace(/\/$/, '');
}

/** Dónde cae la vocal en el trapecio dibujado: `x` de 0 a 1 del ancho y `y` de 0 a `PROPORCION`. */
export function enTrapecio(p: PosicionVocal): { x: number; y: number } {
  const borde = INCLINACION * p.abierta;
  return { x: borde + p.atras * (1 - borde), y: p.abierta * PROPORCION };
}

/** La posición de una vocal inglesa (su `ipa` con o sin barras), o null si no es un punto del gráfico. */
export function posicionVocal(ipa: string): PosicionVocal | null {
  return VOCALES[sinBarras(ipa)] ?? null;
}

interface Cercana {
  vocal: VocalEs;
  distancia: number;
}

/** Las vocales del español ordenadas de la más cercana a la más lejana, medidas en el trapecio dibujado. */
export function cercanasEs(p: PosicionVocal): Cercana[] {
  const a = enTrapecio(p);
  return ORDEN_ES.map((vocal) => {
    const b = enTrapecio(VOCALES_ES[vocal]);
    return { vocal, distancia: Math.hypot(a.x - b.x, a.y - b.y) };
  }).sort((m, n) => m.distancia - n.distancia);
}

/**
 * Lo que dice el mapa de una vocal, para el lector de pantalla: «Entre la i y la e del español, más cerca de la e».
 * Sale de las dos vocales españolas más cercanas en el mapa, no de una confusión afirmada. Null si la vocal no está
 * en la tabla.
 */
export function descripcionMapa(ipa: string): string | null {
  const p = posicionVocal(ipa);
  if (!p) return null;
  const [primera, segunda] = cercanasEs(p) as [Cercana, Cercana];
  if (primera.distancia < MISMO_LUGAR) return `Casi en el mismo lugar que la ${primera.vocal} del español`;
  const [antes, despues] =
    ORDEN_ES.indexOf(primera.vocal) < ORDEN_ES.indexOf(segunda.vocal)
      ? [primera.vocal, segunda.vocal]
      : [segunda.vocal, primera.vocal];
  const par = `Entre la ${antes} y la ${despues} del español`;
  return segunda.distancia - primera.distancia < EMPATE ? `${par}, a medio camino` : `${par}, más cerca de la ${primera.vocal}`;
}
