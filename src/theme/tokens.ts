/**
 * Tokens de diseño. Ningún componente define colores ni medidas propias:
 * todo sale de aquí para que un cambio de paleta sea un cambio de archivo.
 *
 * v5.1: magenta nocturno.
 *
 * Wero enseña el inglés que no está en los libros: jerga de calle, AAVE,
 * hip-hop, oficina. Ese idioma se aprende de oído y vive de noche, en
 * letreros y bocinas. De ahí sale la dirección: tinta magenta profunda y
 * un rosa neón que suena a synthwave, la misma noche urbana en otra llave.
 *
 * Cinco decisiones que sostienen todo lo demás:
 *
 * 1. UNA sola fuente de luz, arriba a la izquierda (`sol`). Todo brillo
 *    de canto y toda sombra la obedecen. Cuando cada tarjeta inventa su
 *    propia luz, el ojo detecta la mentira aunque no sepa nombrarla.
 *
 * 2. Las tarjetas no llevan borde sólido: llevan FILO DE LUZ. Un borde de
 *    1px pintado como degradado, que brilla del lado del sol y se apaga
 *    del opuesto (`filoLuz`). Un borde parejo convierte una lista en una
 *    reja; el filo la convierte en capas de vidrio.
 *
 * 3. El acento es magenta, no ámbar. Y es una restricción del producto,
 *    no un gusto: el ámbar ya está ocupado por el FALLO, y por muy buena
 *    razón (ver `wrong`). Si la marca fuera ámbar, el color de "te
 *    equivocaste" sería el color de la app.
 *
 * 4. El fondo es un degradado, no un color plano. Se aclara arriba, donde
 *    está el sol, y se hunde abajo. Es sutil a propósito: lo que hace no
 *    es verse, es que las tarjetas floten.
 *
 * 5. Hay una sola superficie de color en toda la app, y es de contraste,
 *    no de tema: la tarjeta de "tu sesión de hoy" (`contraste`). Una
 *    sola, o deja de resaltar.
 */

export const color = {
  // Fondos. Tinta magenta, no negro puro: el negro absoluto produce halo en
  // paneles OLED y hace que el texto claro vibre en sesiones largas.
  bg: '#0F0B14',
  /** Abajo del degradado. La parte honda. */
  bgFin: '#0A0710',
  bgAlto: '#181220',
  surface: '#1A1422',
  surfaceAlt: '#231B2E',
  surfaceHigh: '#2C2338',
  surfaceSolida: '#1A1422',
  /** `surface` sin opacidad: el extremo transparente de un degradado que se funde con ella (el final de una fila recortada). */
  surfaceSinAlfa: 'rgba(26, 20, 34, 0)',

  // Texto. Hueso violeta, no blanco puro: el #FFF sobre tinta vibra y
  // cansa igual que el negro sobre papel blanco.
  //
  // textFaint se aclaró de #8C7F96 (fallaba AA sobre surfaceAlt, surfaceHigh
  // y contraste) a #968A9F. Todos los pares de texto pasan 4.5:1 sobre las
  // ocho superficies; ver la tabla de contrastes en DESIGN.md.
  text: '#F5EEF8',
  textMuted: '#C3B6CC',
  textFaint: '#968A9F',

  // Escala 50–900 de los neutros (COLOR-3), tinta violeta. Los pasos 50, 200,
  // 300, 700, 800 y 900 son `text`, `textMuted`, `textFaint`, `surfaceHigh`,
  // `surface` y `bg`; el resto está interpolado entre ellos.
  neutral50: '#F5EEF8',
  neutral100: '#DDCFE5',
  neutral200: '#C3B6CC',
  neutral300: '#968A9F',
  neutral400: '#7C6B8B',
  neutral500: '#615171',
  neutral600: '#463955',
  neutral700: '#2C2338',
  neutral800: '#1A1422',
  neutral900: '#0F0B14',

  border: '#2E2438',
  borderStrong: '#523D67',

  // Magenta eléctrico (synthwave). Sobre tinta se lee como una señal
  // encendida, y deja libres el ámbar para el fallo y el verde para el acierto.
  accent: '#FF3DAA',
  accentSoft: 'rgba(255, 61, 170, 0.14)',
  // Aclarado de #D1167F: no pasaba 4.5:1 contra varias superficies (no es
  // texto en la app hoy, pero se deja pasando AA para no dejar cabos sueltos).
  accentDeep: '#ED51A8',
  // Escala 50–900 del acento (COLOR-3). El 400 es `accent`; los demás salen de
  // la misma familia en OKLCH, con luminosidad pareja entre pasos.
  accent50: '#FFE0F2',
  accent100: '#FFB8E0',
  accent200: '#FF8FCE',
  accent300: '#FF66BC',
  accent400: '#FF3DAA',
  accent500: '#FF0E95',
  accent600: '#DE007D',
  accent700: '#AF0063',
  accent800: '#800048',
  accent900: '#52002E',

  // Texto encima del magenta: tinta, no blanco. Blanco sobre magenta no pasa
  // contraste y se ve lavado.
  onAccent: '#1A0612',

  /** La única superficie de color. De contraste, no de tema. */
  contraste: '#3A1640',
  onContraste: '#F5EEF8',
  // Escala 50–900 del primario (COLOR-3). El 800 es `contraste`.
  contraste50: '#F5E8F7',
  contraste100: '#E5C4EB',
  contraste200: '#D59FDE',
  contraste300: '#C57AD1',
  contraste400: '#B556C5',
  contraste500: '#9D3CAE',
  contraste600: '#7C2F89',
  contraste700: '#5B2365',
  contraste800: '#3A1640',
  contraste900: '#250E29',

  correct: '#3DDC97',
  correctSoft: 'rgba(61, 220, 151, 0.12)',
  correctDeep: '#1FAC6F',
  // El fallo es ámbar, nunca rojo: el usuario va a fallar cientos de
  // veces por diseño y cómo se siente eso decide si sigue en la semana 4.
  // Esta regla es anterior al rediseño y se mantiene intacta.
  wrong: '#F5B942',
  wrongSoft: 'rgba(245, 185, 66, 0.12)',
  wrongDeep: '#D99A1E',

  // Estrellas y aciertos seguidos. Dorado, nunca menos de 10.37:1 sobre las
  // ocho superficies.
  star: '#FFD166',
  // El filo de las celdas con las tres estrellas: `star` al 32 %. Es un borde fijo, no un
  // degradado: son hasta doscientas celdas en una lista y cada capa cuesta al hacer scroll.
  starFilo: 'rgba(255, 209, 102, 0.32)',

  riskWarn: '#F5B942',
  riskWarnSoft: 'rgba(245, 185, 66, 0.12)',
  // El único rojo que queda, y solo para lenguaje explícito. Es el lugar
  // donde el rojo sí significa algo.
  riskStrong: '#F37B68',
  riskStrongSoft: 'rgba(243, 123, 104, 0.12)',

  // Colores de mundo (COLOR-1). Una familia: misma luminosidad (OKLCH L 0.73) y
  // misma saturación (C 0.12); solo cambia el tono. Ninguno queda a menos de
  // 24° del acento, de `correct`, de `wrong` ni de `riskStrong`, y todos pasan
  // 4.5:1 sobre las ocho superficies (el más bajo, `tech`, da 5.53). Van en
  // chico: un punto, una etiqueta y una barra fina; nunca en fondos grandes
  // ni en botones. `calle` y `gente` se recalcularon de tono: chocaban con
  // el acento (a 1° y 24°) y, tras separarse de él, entre sí. Las piezas de
  // Dulces no llevan estos tintes: usan `dulce` (ver más abajo).
  world: {
    dia_a_dia: '#87ADDC',
    calle: '#CAD368',
    dinero: '#80CE55',
    gente: '#88DD89',
    cultura: '#AEA3E4',
    tech: '#32AEAA',
    legal: '#C98BDD',
    fonetica: '#BEC539',
  },

  /**
   * Colores de Dulces (COLOR-1, excepción): paleta Okabe-Ito, pensada para distinguirse
   * también con daltonismo. Es contenido de juego, no de marca: nunca cambia con la paleta
   * de la app. `celeste`, `naranja`, `verde` y `rosa` se afinaron de brillo (mismo matiz)
   * para que ningún par de los seis quede a menos de 0.08 de luminancia en gris; `azul` es
   * el sexto color de Okabe-Ito, agregado porque hay niveles que piden 6 colores (con solo
   * 5, el sexto se repetiría con el primero). Los tonos de cara/canto/símbolo de cada uno
   * viven en `pieza.tintes`, más abajo, y se repiten literales por cómo los lee
   * `check-dulces.mjs`; si cambias uno, cambia el otro.
   */
  dulce: {
    amarillo: '#F0E442',
    naranja: '#F5A900',
    celeste: '#50B2E9',
    verde: '#00956D',
    rosa: '#CE7DA9',
    azul: '#006EAC',
  },

  /** Velo de la respuesta. Opaco de verdad: tapa lo de atrás. */
  velo: 'rgba(10, 7, 16, 0.94)',

  /** Filo iluminado: el canto de arriba de una superficie. */
  filo: 'rgba(255, 255, 255, 0.16)',

  // Fondos de banda de FeedbackBand: una versión hundida del color de
  // veredicto, para que el texto de acierto/fallo no vaya sobre `surface`.
  correctFondo: '#081610',
  wrongFondo: '#181205',

  /** Letra grande de un marcador de imagen/portada pendiente. */
  textSobrePortada: 'rgba(245, 238, 248, 0.22)',
  /** Oscurece una portada con imagen o degradado para que el texto lea. */
  veloPortada: 'rgba(10, 7, 16, 0.42)',
  /** Carril vacío de ProgressBar: más oscuro que la superficie que lo trae. */
  trackFondo: 'rgba(0, 0, 0, 0.38)',
  /** Velo del muro de desbloqueo, sobre el BlurView. */
  veloMuro: 'rgba(10, 7, 16, 0.72)',
  /** Velo de la barra de pestañas, sobre su BlurView. */
  veloBarra: 'rgba(26, 20, 34, 0.72)',
  /** Borde de la pastilla de pestaña activa. */
  accentBorde: 'rgba(255, 61, 170, 0.32)',
  /** Canto inferior de una pieza de juego, para el efecto de relieve. */
  biselSombra: 'rgba(0, 0, 0, 0.45)',
  /** shadowColor genérico: mismo negro que ya usa `shadow`, con nombre. */
  shadow: '#000000',
  /**
   * Verde-naranja del icono de notificación en Android (`lightColor` del
   * canal). Es un requisito del sistema operativo, no de la paleta: no
   * lo cambies para que combine.
   */
  notifAndroid: '#E8543F',
} as const;

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
 * Señal (v5.0). Degradado dentro del mismo tono (COLOR-2): del magenta hondo a
 * la luz. Sale de la escala del acento, no de hex nuevos.
 */
export const senal: [string, string, string] = [color.accent900, color.accent400, color.accent100];

/** Reflejo metálico que cruza el botón principal: blanco que aparece y se va. */
export const reflejo: [string, string, string] = [
  'rgba(255, 255, 255, 0)',
  'rgba(255, 255, 255, 0.38)',
  'rgba(255, 255, 255, 0)',
];

/** El brillo que cruza un hueso de esqueleto: un aclarado suave del mismo tono, nunca blanco puro. */
export const brilloEsqueleto: [string, string, string] = [
  'rgba(245, 238, 248, 0)',
  'rgba(245, 238, 248, 0.08)',
  'rgba(245, 238, 248, 0)',
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
  neutro: ['#1B242F', '#111820'],
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
 * Luz de escena de la señal (v5.0). No es sombra de color (IA-3): es luz que
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

export type WorldId = keyof typeof color.world;
