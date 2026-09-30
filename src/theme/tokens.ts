/**
 * Tokens de diseño derivados de la paleta (`paleta.ts`): luz, degradados, espacios, radios, sombras,
 * tipografía y medidas. Ningún componente define colores ni medidas propias.
 */
import { color } from './paleta';

/** rgba() de un hex de `color`, para que los degradados de luz de abajo sigan al acento y al veredicto en vez de quedar fijos en un tono viejo si vuelven a cambiar. */
function conAlfa(hex: string, alfa: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

/**
 * Fondo de pantalla. Se aclara arriba, donde vive el sol, y se hunde
 * abajo. No está para verse: está para que las tarjetas floten.
 */
export const FONDO: [string, string] = [color.bgAlto, color.bgFin];

/** El desvanecido del borde derecho de una fila que scrollea sobre el fondo de `Screen`: su tono de arriba, de transparente a sólido. */
export const desvaneceDerecha: [string, string] = [conAlfa(color.bgAlto, 0), color.bgAlto];

/** Dirección del sol. Se pasa como start/end en cada LinearGradient. */
export const sol = {
  start: { x: 0, y: 0 },
  end: { x: 0.9, y: 1 },
} as const;

/**
 * Filo de luz: brilla del lado del sol y se apaga del opuesto. Se pinta
 * como envoltura de 1px por detrás de la superficie.
 *
 * React Native no tiene mask-composite, así que el borde degradado se
 * consigue anidando dos degradados. Es la técnica estándar y cuesta dos
 * vistas: prácticamente nada comparado con un BlurView.
 */
export const filoLuz: [string, string, string] = [
  'rgba(255, 255, 255, 0.28)',
  'rgba(255, 255, 255, 0.04)',
  conAlfa(color.accent, 0.18),
];

/** Filo de luz teñido de veredicto, para la banda de acierto/fallo. */
export const filoOk: [string, string, string] = [
  'rgba(255, 255, 255, 0.30)',
  conAlfa(color.correct, 0.10),
  conAlfa(color.correct, 0.30),
];
export const filoWrong: [string, string, string] = [
  'rgba(255, 255, 255, 0.30)',
  conAlfa(color.wrong, 0.10),
  conAlfa(color.wrong, 0.30),
];

/**
 * Las piezas de Dulces: contenido de juego, no marca. Un tinte por color de `color.dulce`
 * (amarillo, naranja, celeste, verde, rosa, azul, en ese orden: el mismo de `piezas.ts#FORMAS`
 * — círculo, triángulo, cuadrado, rombo, estrella, hexágono). Cada pieza es un degradado del
 * MISMO tono (COLOR-2): el claro donde da el sol (arriba a la izquierda), el medio (el color
 * de `color.dulce`) y el oscuro, para el canto hundido. `simbolo` es la forma al centro, un
 * tono del mismo matiz un 70 % más oscuro que el medio (no blanco: sobre `amarillo` o
 * `celeste`, claros, un símbolo blanco casi no se vería), a 3:1 de contraste como mínimo.
 * `check-dulces.mjs` lee este bloque con una expresión regular literal: no lo vuelvas una
 * referencia a `color.dulce` ni le cambies el formato de una línea por tinte.
 */
export const pieza = {
  /** El brillo del sol arriba a la izquierda: blanco que se apaga. */
  brillo: 'rgba(255, 255, 255, 0.26)',
  brilloFin: 'rgba(255, 255, 255, 0)',
  tintes: [
    { claro: '#F2EB87', medio: '#F0E442', oscuro: '#D9CC11', simbolo: '#555007' },
    { claro: '#FAC142', medio: '#F5A900', oscuro: '#AE7800', simbolo: '#4A3300' },
    { claro: '#93CDEE', medio: '#50B2E9', oscuro: '#1B93D7', simbolo: '#0A3953' },
    { claro: '#06D79F', medio: '#00956D', oscuro: '#004E39', simbolo: '#002D21' },
    { claro: '#DFB4CB', medio: '#CE7DA9', oscuro: '#BA4987', simbolo: '#481B34' },
    { claro: '#069AED', medio: '#006EAC', oscuro: '#004065', simbolo: '#002134' },
  ],
} as const;

/** El resplandor del piso de Caída: del aire (arriba) al `accent` al 40 % (abajo). Nunca rojo ni ámbar: todavía no ha pasado nada. */
export const resplandorPiso: [string, string] = [conAlfa(color.accent, 0), conAlfa(color.accent, 0.4)];

/** El sol del sistema, hecho visible como resplandor en `Screen`. */
export const resplandorSol: [string, string, string] = [
  conAlfa(color.accent, 0.16),
  conAlfa(color.accent, 0.04),
  conAlfa(color.accent, 0),
];

/**
 * Señal. Degradado dentro del mismo tono (COLOR-2): del azul marino hondo al
 * cobalto y a la luz. Sale de tokens de `color`, no de hex nuevos.
 */
export const senal: [string, string, string] = [color.senalInicio, color.senalMedio, color.senalFin];

/** Reflejo metálico que cruza el botón principal: blanco que aparece y se va. */
export const reflejo: [string, string, string] = [
  'rgba(255, 255, 255, 0)',
  'rgba(255, 255, 255, 0.38)',
  'rgba(255, 255, 255, 0)',
];

/** El brillo que cruza un hueso de esqueleto: un aclarado suave del mismo tono, nunca blanco puro. */
export const brilloEsqueleto: [string, string, string] = [
  conAlfa(color.text, 0),
  conAlfa(color.text, 0.08),
  conAlfa(color.text, 0),
];

/**
 * Degradados de portada. Tintados y oscuros, para que el texto claro
 * encima se lea sin necesidad de velo negro.
 */
/**
 * Degradado de las portadas: uno solo, neutro. El color del mundo ya no tiñe
 * fondos grandes (COLOR-1): aparece en un punto, una etiqueta y una barra fina.
 * `Card` cae aquí con cualquier clave de mundo o de modo.
 */
export const gradiente: Record<string, [string, string]> = {
  neutro: [color.portadaInicio, color.portadaFin],
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 36,
  pill: 999,
} as const;

/** Área táctil de un botón circular de icono: nunca menos de 48 dp (MOV-1). */
export const iconoRedondo = {
  sm: 48,
  md: 48,
  lg: 52,
} as const;

/** El círculo que se ve, centrado dentro del área táctil. */
export const iconoVisual = {
  sm: 36,
  md: 44,
  lg: 52,
} as const;

/**
 * Sombras.
 *
 * En oscuro la sombra ya no separa por sí sola: no hay contraste de
 * luminancia que aprovechar. El trabajo de separación lo hace el filo de
 * luz, y la sombra queda para dar ALTURA. Por eso van negras y densas en
 * vez de tintadas y suaves como en la versión clara.
 */
export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.7,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
} as const;

/** Intensidad del desenfoque. 0 a 100 en expo-blur. */
export const blur = {
  suave: 18,
  medio: 32,
  fuerte: 55,
} as const;

/** Grosor del borde inferior que hace ver un control como pieza física. */
export const depth = {
  sm: 2,
  md: 3,
  lg: 4,
} as const;

export const font = {
  size: {
    // 11 es el suelo de legibilidad y estas etiquetas llevan información
    // real (text.tiny, pestañas, insignias): no un tamaño decorativo.
    xs: 12,
    sm: 13,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  /**
   * Un nombre por peso: con fuentes propias, `fontWeight` no elige la cara
   * (en Android inventa un negrita sintético), así que el peso va en la
   * familia. Los nombres son las llaves de `fuentes.ts`.
   *
   * Bricolage Grotesque para títulos y cifras grandes; Instrument Sans para
   * todo lo demás; Charis SIL solo para IPA.
   */
  family: {
    display: 'BricolageGrotesque-Bold',
    heading: 'BricolageGrotesque-SemiBold',
    body: 'InstrumentSans-Regular',
    bodyStrong: 'InstrumentSans-SemiBold',
    ipa: 'CharisSIL',
  },
} as const;

/**
 * El botón «Continuar con Google» sigue los lineamientos de marca de Google
 * (Sign in with Google Branding Guidelines), no la paleta de Wero: variante
 * oscura (fondo, borde y texto de esa guía), la «G» con sus cuatro colores sin
 * alterar y Roboto Medium, que en Android es la fuente del sistema.
 */
export const marcaGoogle = {
  fondo: '#131314',
  borde: '#8E918F',
  texto: '#E3E3E3',
  azul: '#4285F4',
  verde: '#34A853',
  amarillo: '#FBBC05',
  rojo: '#EA4335',
  fuente: 'sans-serif-medium',
} as const;

export const layout = {
  tapMin: 48,
  cardMaxWidth: 520,
  screenPad: space.lg,
  /** Alto de la barra de anuncios. El tab bar se levanta esto. */
  adBar: 56,
  /** Alto mínimo de un renglón de modo en Practicar. */
  filaModo: 56,
} as const;

/**
 * Luz de escena de la señal. No es sombra de color (IA-3): es luz que
 * vive detrás del contenido. `opacidadMax` es el techo de la aurora; `paralaje`
 * lo que se desplaza con el giroscopio; `resolucion` la escala a la que se
 * pinta el shader (media resolución, sube a pantalla sin costo perceptible).
 */
export const aurora = { opacidadMax: 0.18, paralaje: 8, resolucion: 0.25 } as const;

/** Grano fino sobre el fondo. Estático: se pinta una vez. */
export const grano = { opacidad: 0.03 } as const;

/** Alto de las tarjetas de Destacados: la héroe a todo el ancho y las compactas en dos columnas. */
export const tarjeta = { heroe: 180, compacta: 150, portadaHeroe: 96, portadaCompacta: 64 } as const;

/** Anillos de progreso: diámetro y grosor del trazo. */
export const anillo = { hoy: 88, reto: 56, trazo: 8, trazoReto: 6 } as const;

/** Medidor VU del reto: un segmento por acierto de la meta. */
export const medidor = { segmento: 4, separacion: 2, alto: 28 } as const;

/** Inclinación 3D de las tarjetas al mantener presionado. */
export const inclinacion = { maxGrados: 6, perspectiva: 800 } as const;
