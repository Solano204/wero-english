/**
 * Lo puro del mazo de Frases sueltas: cuándo un deslizamiento cuenta como «Siguiente» o como «Guardar», cuánto giran y se
 * asoman las cartas, y cómo se acomoda una frase en su carta según su largo. No importa nada: se prueba con
 * `npm run check:mazo`. Lo que corre en el hilo de UI (el gesto y los estilos animados) lleva 'worklet'.
 */

/** Cómo se apila el mazo. */
export const MAZO = {
  /** Cartas montadas a la vez: la de arriba y las dos que se asoman. */
  cartas: 3,
  /** Cuánto se asoma cada carta de atrás bajo la anterior, en dp. */
  asoma: 8,
  /** Lo que baja la escala por cada lugar de profundidad. */
  encoge: 0.04,
  /** Lo que baja la opacidad por cada lugar de profundidad. */
  aclara: 0.2,
} as const;

/** Lo que cuenta un deslizamiento (dp, dp/s y grados). */
export const GESTO = {
  siguienteDistancia: 96,
  siguienteVelocidad: 800,
  guardarDistancia: 96,
  guardarVelocidad: 900,
  /** Hacia donde la carta no puede ir (a la derecha y hacia abajo) solo cede esta fracción de lo que se arrastra. */
  resistencia: 0.25,
  giroMax: 18,
  /** Velocidad horizontal (dp/s) con la que el giro de salida llega a `giroMax`. */
  giroVelocidad: 2400,
  /** Giro mínimo de una salida, como fracción de `giroMax`: hasta la más lenta se inclina un poco. */
  giroMin: 0.35,
  /** Grados por dp arrastrado mientras el dedo la lleva. */
  giroArrastre: 0.05,
  /** Cuánto pesa la velocidad (dp de arrastre por cada dp/s) al decidir en qué eje va el gesto. */
  pesoVelocidad: 0.1,
} as const;

export type Gesto = 'siguiente' | 'guardar' | 'volver';

/**
 * Qué hacer al soltar la carta. `dx` y `dy` es lo arrastrado (dp) y `vx`, `vy` la velocidad del dedo (dp/s). El eje lo
 * decide el que pesa más entre distancia y velocidad. Solo cuentan la izquierda («Siguiente») y arriba («Guardar»):
 * a la derecha y hacia abajo la carta regresa. Pasa el umbral por distancia o por velocidad, lo que llegue primero.
 */
export function decidirGesto(dx: number, dy: number, vx: number, vy: number): Gesto {
  'worklet';
  const horizontal = Math.abs(dx) + Math.abs(vx) * GESTO.pesoVelocidad >= Math.abs(dy) + Math.abs(vy) * GESTO.pesoVelocidad;
  if (horizontal) {
    return dx < 0 && (-dx >= GESTO.siguienteDistancia || -vx >= GESTO.siguienteVelocidad) ? 'siguiente' : 'volver';
  }
  return dy < 0 && (-dy >= GESTO.guardarDistancia || -vy >= GESTO.guardarVelocidad) ? 'guardar' : 'volver';
}

/** Qué tan cerca está «Siguiente» mientras se arrastra: de 0 a 1, solo si el arrastre va más a la izquierda que arriba. */
export function avanceSiguiente(dx: number, dy: number): number {
  'worklet';
  if (dx >= 0 || Math.abs(dx) < Math.abs(dy)) return 0;
  return Math.min(1, -dx / GESTO.siguienteDistancia);
}

/** Qué tan cerca está «Guardar» mientras se arrastra: de 0 a 1, solo si el arrastre va más arriba que a la izquierda. */
export function avanceGuardar(dx: number, dy: number): number {
  'worklet';
  if (dy >= 0 || Math.abs(dy) <= Math.abs(dx)) return 0;
  return Math.min(1, -dy / GESTO.guardarDistancia);
}

/** Hacia donde la carta no puede ir solo cede una fracción de lo arrastrado. */
export function amortiguar(d: number): number {
  'worklet';
  return d < 0 ? d : d * GESTO.resistencia;
}

/** El giro (grados, contra el reloj) con el que sale una carta lanzada a la izquierda: más rápido el dedo, más se inclina. */
export function giroDeSalida(vx: number): number {
  'worklet';
  const k = Math.min(1, Math.max(GESTO.giroMin, Math.abs(vx) / GESTO.giroVelocidad));
  return -k * GESTO.giroMax;
}

/** El giro mientras el dedo la lleva. */
export function giroDeArrastre(dx: number): number {
  'worklet';
  return Math.max(-GESTO.giroMax, Math.min(GESTO.giroMax, dx * GESTO.giroArrastre));
}

/** Los lugares de profundidad de una carta (0 la de arriba), sin salirse del mazo. */
function lugar(d: number): number {
  'worklet';
  return d < 0 ? 0 : d > MAZO.cartas - 1 ? MAZO.cartas - 1 : d;
}

/** Cuánto baja una carta por estar detrás (dp). `d` es su lugar en el mazo, con decimales mientras el mazo avanza. */
export function bajaDeProfundidad(d: number): number {
  'worklet';
  return lugar(d) * MAZO.asoma;
}

export function escalaDeProfundidad(d: number): number {
  'worklet';
  return 1 - lugar(d) * MAZO.encoge;
}

export function opacidadDeProfundidad(d: number): number {
  'worklet';
  return 1 - lugar(d) * MAZO.aclara;
}

/** Las posiciones de la baraja que están montadas: la de arriba y hasta dos más, sin pasar del final. */
export function indicesVisibles(actual: number, total: number): number[] {
  const fin = Math.min(total, actual + MAZO.cartas);
  return Array.from({ length: Math.max(0, fin - actual) }, (_, k) => actual + k);
}

export type TamanoFrase = 'lg' | 'md' | 'h3';

/** Cuánto aire y cuánto texto lleva una carta: la más holgada que quepa en el alto que hay. */
export type Densidad = 'normal' | 'compacta' | 'minima';

const ORDEN_DENSIDAD: readonly Densidad[] = ['normal', 'compacta', 'minima'];

/** Lo que cambia con la densidad: aire entre partes, margen de la carta, renglones máximos (0 = no se dibuja) y si la frase baja un tamaño. */
export const DENSIDAD = {
  normal: { aire: 12, margen: 16, ipa: 2, traduccion: 3, nota: 3, bajaFrase: false },
  compacta: { aire: 8, margen: 12, ipa: 2, traduccion: 3, nota: 2, bajaFrase: false },
  minima: { aire: 8, margen: 12, ipa: 1, traduccion: 2, nota: 0, bajaFrase: true },
} as const;

/** El tamaño de la frase en su carta: `lg` (28) hasta 40 caracteres, `md` (22) hasta 80 y `h3` (18) el resto; en `minima`, un tamaño menos. */
export function tamanoFrase(caracteres: number, densidad: Densidad = 'normal'): TamanoFrase {
  const base: TamanoFrase = caracteres <= 40 ? 'lg' : caracteres <= 80 ? 'md' : 'h3';
  if (!DENSIDAD[densidad].bajaFrase) return base;
  return base === 'lg' ? 'md' : 'h3';
}

/** Lo que se dibuja en una carta y ocupa alto. */
export interface ContenidoCarta {
  phrase: string;
  ipa: string | null;
  spanish_main: string;
  note: string | null;
  vulgaridad: number;
}

/** Ancho medio de un carácter y alto de renglón (dp) de cada texto de la carta: son estimaciones, no medidas. */
const TEXTO = {
  lg: { caracter: 14.5, renglon: 35 },
  md: { caracter: 11, renglon: 28.6 },
  h3: { caracter: 9.4, renglon: 25.2 },
  ipa: { caracter: 8.6, renglon: 24 },
  traduccion: { caracter: 9.4, renglon: 25.2 },
  nota: { caracter: 8.2, renglon: 24 },
} as const;
/** Lo que se agrega por el corte de renglón a media palabra. */
const HOLGURA_RENGLON = 1.08;
const ALTO_GRUPO_AUDIO = 48;
const ALTO_ETIQUETA = 28;
/** Renglones máximos de la frase: no se corta (se lee entera), pero un tope evita estimaciones absurdas. */
const RENGLONES_FRASE = 8;
/** Alto de la franja de imagen de una carta, en dp. */
export const ALTO_IMAGEN = 96;

function renglones(caracteres: number, caracter: number, ancho: number, tope: number): number {
  return Math.min(tope, Math.max(1, Math.ceil((caracteres * caracter * HOLGURA_RENGLON) / ancho)));
}

/**
 * Cuánto mide el contenido de una carta (dp) con `ancho` para el texto, sin imagen. Son estimaciones: sirven para
 * elegir la densidad y para saber si sobra lugar para la imagen; el alto real lo da el teléfono.
 */
export function alturaEstimada(c: ContenidoCarta, ancho: number, densidad: Densidad = 'normal'): number {
  const d = DENSIDAD[densidad];
  const tam = TEXTO[tamanoFrase(c.phrase.length, densidad)];
  const partes = [
    renglones(c.phrase.length, tam.caracter, ancho, RENGLONES_FRASE) * tam.renglon,
    ...(c.ipa ? [renglones(c.ipa.length, TEXTO.ipa.caracter, ancho, d.ipa) * TEXTO.ipa.renglon] : []),
    ALTO_GRUPO_AUDIO,
    renglones(c.spanish_main.length, TEXTO.traduccion.caracter, ancho, d.traduccion) * TEXTO.traduccion.renglon,
    ALTO_GRUPO_AUDIO,
    ...(c.vulgaridad > 0 ? [ALTO_ETIQUETA] : []),
    ...(c.note && d.nota > 0 ? [renglones(c.note.length, TEXTO.nota.caracter, ancho, d.nota) * TEXTO.nota.renglon] : []),
  ];
  return partes.reduce((s, p) => s + p, 0) + d.aire * (partes.length - 1) + d.margen * 2;
}

/** La densidad más holgada en la que la carta cabe en `alto`; si ni la mínima cabe, la mínima. */
export function elegirDensidad(c: ContenidoCarta, ancho: number, alto: number): Densidad {
  return ORDEN_DENSIDAD.find((d) => alturaEstimada(c, ancho, d) <= alto) ?? 'minima';
}

/** ¿Sobra alto en la carta para una franja de imagen arriba? */
export function cabeImagen(altoCarta: number, altoContenido: number, densidad: Densidad = 'normal'): boolean {
  return altoCarta - altoContenido >= ALTO_IMAGEN + DENSIDAD[densidad].aire;
}
