/**
 * La geometría de la ruleta de partículas de Phrasal verbs, en números. La rueda vive en el hilo de UI, así que todo
 * lo que toca `pos` (la posición fraccionaria: 3.0 es «la cuarta partícula está al centro») son funciones puras y
 * marcadas como worklets. Se prueba con `npm run check:ruleta`.
 *
 * Los renglones van a un paso lineal de `ALTO_ITEM` (48 dp: cada partícula es un toque de 48 dp exactos); la
 * perspectiva la dan la escala, el giro sobre el eje horizontal y la opacidad, no un paso más corto.
 */

/** Alto de cada partícula y paso entre una y la siguiente, en dp. */
export const ALTO_ITEM = 48;
/** Cuántas partículas se dibujan a cada lado de la elegida: las demás no se renderizan. */
export const VISIBLES = 2;
/** Cuánto giran, en grados por partícula de distancia, las que están arriba y abajo. */
export const GIRO_GRADOS = 30;
/** Cuánto de lo que sigue el dedo se ve cuando se jala más allá de la primera o la última (0 a 1). */
export const ELASTICIDAD = 0.35;
/** Segundos de velocidad del dedo que se proyectan al soltar para decidir dónde se asienta. */
export const PROYECCION_S = 0.15;

/** Escala de la partícula a 0, 1 y 2 lugares del centro. */
const ESCALAS = [1, 0.68, 0.5] as const;
/** Opacidad a 1 lugar; a 2 ya no se ve. */
const OPACIDAD_VECINA = 0.55;

export interface Pose {
  /** Desplazamiento vertical respecto del centro, en dp. */
  y: number;
  escala: number;
  /** Giro sobre el eje horizontal, en grados. */
  giro: number;
  opacidad: number;
}

/**
 * Cómo se dibuja una partícula a `d` lugares del centro (`d = índice - pos`, fraccionario mientras se gira). La del
 * centro va entera; las vecinas más chicas, giradas hacia atrás y más tenues; a `VISIBLES` lugares desaparece.
 */
export function poseItem(d: number): Pose {
  'worklet';
  const a = Math.min(Math.abs(d), VISIBLES);
  const signo = d < 0 ? -1 : 1;
  const tramo = Math.min(Math.floor(a), VISIBLES - 1);
  const t = a - tramo;
  const escala = ESCALAS[tramo]! + (ESCALAS[tramo + 1]! - ESCALAS[tramo]!) * t;
  const opacidad = a <= 1 ? 1 - (1 - OPACIDAD_VECINA) * a : OPACIDAD_VECINA * (VISIBLES - a);
  return { y: d * ALTO_ITEM, escala, giro: a === 0 ? 0 : -signo * GIRO_GRADOS * a, opacidad };
}

/** El índice más cercano a `x`, dentro de la lista de `n`. */
export function limitarIndice(x: number, n: number): number {
  'worklet';
  return Math.min(n - 1, Math.max(0, Math.round(x)));
}

/** La posición que se ve al jalar: igual dentro de la lista, y más allá de los extremos solo sigue una parte del dedo. */
export function posElastica(pos: number, n: number): number {
  'worklet';
  const ultimo = n - 1;
  if (pos < 0) return pos * ELASTICIDAD;
  if (pos > ultimo) return ultimo + (pos - ultimo) * ELASTICIDAD;
  return pos;
}

/**
 * Dónde se asienta la rueda al soltar el dedo: la posición proyectada con su velocidad (dp/s, positiva hacia abajo),
 * redondeada y sin salirse de la lista. Con el dedo hacia arriba avanza a las siguientes partículas.
 */
export function destinoSuelta(pos: number, velocidadY: number, n: number): number {
  'worklet';
  return limitarIndice(pos - (velocidadY * PROYECCION_S) / ALTO_ITEM, n);
}

/** A qué partícula lleva un toque: `y` es la altura del toque dentro de la rueda, que mide `alto`, con el centro a la mitad. */
export function destinoToque(y: number, alto: number, pos: number, n: number): number {
  'worklet';
  return limitarIndice(Math.round(pos) + Math.round((y - alto / 2) / ALTO_ITEM), n);
}
