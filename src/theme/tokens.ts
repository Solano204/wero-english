/**
 * Tokens de diseño. Ningún componente define colores ni medidas propias:
 * todo sale de aquí para que un cambio de paleta sea un cambio de archivo.
 *
 * v4.0: neón nocturno.
 *
 * Wero enseña el inglés que no está en los libros: jerga de calle, AAVE,
 * hip-hop, oficina. Ese idioma se aprende de oído y vive de noche, en
 * letreros y bocinas. De ahí sale la dirección: tinta azul profunda y un
 * cian eléctrico que suena a señal de audio.
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
 * 3. El acento es cian, no ámbar. Y es una restricción del producto, no
 *    un gusto: el ámbar ya está ocupado por el FALLO, y por muy buena
 *    razón (ver `wrong`). Si la marca fuera ámbar, el color de "te
 *    equivocaste" sería el color de la app.
 *
 * 4. El fondo es un degradado, no un color plano. Se aclara arriba, donde
 *    está el sol, y se hunde abajo. Es sutil a propósito: lo que hace no
 *    es verse, es que las tarjetas floten.
 *
 * 5. Hay una sola superficie de color en toda la app, y es de contraste,
 *    no de tema: la tarjeta de "tu sesión de hoy" (`contraste`). Una
 *    sola, o deja de resaltar. Antes era la única oscura sobre crema;
 *    ahora es la única con color sobre tinta. Mismo papel, invertido.
 */

export const color = {
  // Fondos. Tinta azul, no negro puro: el negro absoluto produce halo en
  // paneles OLED y hace que el texto claro vibre en sesiones largas.
  bg: '#0A0F16',
  /** Abajo del degradado. La parte honda. */
  bgFin: '#06090D',
  bgAlto: '#101823',
  surface: '#141D28',
  surfaceAlt: '#1A2532',
  surfaceHigh: '#22303F',
  surfaceSolida: '#141D28',
  /** `surface` sin opacidad: el extremo transparente de un degradado que se funde con ella (el final de una fila recortada). */
  surfaceSinAlfa: 'rgba(20, 29, 40, 0)',

  // Texto. Hueso azulado, no blanco puro: el #FFF sobre tinta vibra y
  // cansa igual que el negro sobre papel blanco.
  //
  // textMuted y textFaint subieron de luminancia (saltos de 1.67x y 1.5x
  // entre los tres niveles): las versiones anteriores fallaban AA sobre
  // las cinco superficies de la app, textFaint incluso a 2.71 sobre
  // `contraste`. Ver la tabla de contrastes en docs/DISENO.md.
  text: '#EAF2F9',
  textMuted: '#B4C2CE',
  textFaint: '#90A2B4',

  // Escala 50–900 de los neutros (COLOR-3), tinta azulada. Los pasos 50, 200,
  // 300, 700, 800 y 900 son `text`, `textMuted`, `textFaint`, `surfaceHigh`,
  // `surface` y `bg`; el resto está interpolado entre ellos.
  neutral50: '#EAF2F9',
  neutral100: '#CFDAE3',
  neutral200: '#B4C2CE',
  neutral300: '#90A2B4',
  neutral400: '#728395',
  neutral500: '#566677',
  neutral600: '#3B4A5A',
  neutral700: '#22303F',
  neutral800: '#141D28',
  neutral900: '#0A0F16',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',

  // Cian eléctrico. Sobre tinta se lee como una señal encendida, y deja
  // libres el ámbar para el fallo y el verde para el acierto.
  accent: '#45D9FF',
  accentSoft: 'rgba(69, 217, 255, 0.14)',
  accentDeep: '#17ABD8',
  // Escala 50–900 del acento (COLOR-3). El 400 es `accent`; los demás salen de
  // la misma familia en OKLCH, con luminosidad pareja entre pasos.
  accent50: '#E7F9FE',
  accent100: '#CDF3FF',
  accent200: '#A9EAFE',
  accent300: '#7FE1FE',
  accent400: '#45D9FF',
  accent500: '#2EC4E8',
  accent600: '#19A2C2',
  accent700: '#147E97',
  accent800: '#15596A',
  accent900: '#113B47',

  // Texto encima del cian: tinta, no blanco. Blanco sobre cian no pasa
  // contraste y se ve lavado.
  onAccent: '#04141C',

  /** La única superficie de color. De contraste, no de tema. */
  contraste: '#0B3A50',
  onContraste: '#EAF7FD',
  // Escala 50–900 del primario (COLOR-3). El 800 es `contraste`.
  contraste50: '#ECF7FD',
  contraste100: '#D5ECF9',
  contraste200: '#B2D7ED',
  contraste300: '#8BBFDE',
  contraste400: '#63A4C8',
  contraste500: '#4086AB',
  contraste600: '#286B8C',
  contraste700: '#195370',
  contraste800: '#0B3A50',
  contraste900: '#0C2A39',

  correct: '#4ADE9B',
  correctSoft: 'rgba(74, 222, 155, 0.12)',
  correctDeep: '#22B87A',
  // El fallo es ámbar, nunca rojo: el usuario va a fallar cientos de
  // veces por diseño y cómo se siente eso decide si sigue en la semana 4.
  // Esta regla es anterior al rediseño y se mantiene intacta.
  wrong: '#F2B33D',
  wrongSoft: 'rgba(242, 179, 61, 0.12)',
  wrongDeep: '#CF9320',

  // Estrellas y aciertos seguidos. Dorado (tono 95), a 16° del ámbar de fallo
  // (`wrong`, tono 79) y a 16° de `world.fonetica` (tono 112). Pasa 7.4:1.
  star: '#E9C944',
  // El filo de las celdas con las tres estrellas: `star` al 32 %. Es un borde fijo, no un
  // degradado: son hasta doscientas celdas en una lista y cada capa cuesta al hacer scroll.
  starFilo: 'rgba(233, 201, 68, 0.32)',

  riskWarn: '#F2B33D',
  riskWarnSoft: 'rgba(242, 179, 61, 0.12)',
  // El único rojo que queda, y solo para lenguaje explícito. Es el lugar
  // donde el rojo sí significa algo.
  riskStrong: '#FF7A66',
  riskStrongSoft: 'rgba(255, 122, 102, 0.12)',

  // Colores de mundo (COLOR-1). Una familia: misma luminosidad (OKLCH L 0.73) y
  // misma saturación (C 0.12); solo cambia el tono. Ninguno queda a menos de
  // 24° del acento, de `correct`, de `wrong` ni de `riskStrong`, y todos pasan
  // 4.5:1 sobre las ocho superficies. Van en chico: un punto, una etiqueta, una
  // barra fina y el tinte de los cubitos; nunca en fondos grandes ni en botones
  // (salvo las piezas de Dulces, que son contenido de juego).
  world: {
    dia_a_dia: '#71ABF2',
    calle: '#E1925A',
    dinero: '#86B96A',
    gente: '#DD88B9',
    cultura: '#A89AED',
    tech: '#21BFBB',
    legal: '#C78FD9',
    fonetica: '#AAAF4F',
  },

  /** Velo de la respuesta. Opaco de verdad: tapa lo de atrás. */
  velo: 'rgba(9, 13, 19, 0.94)',

  /** Filo iluminado: el canto de arriba de una superficie. */
  filo: 'rgba(255, 255, 255, 0.16)',

  // Fondos de banda de FeedbackBand: una versión hundida del color de
  // veredicto, para que el texto de acierto/fallo no vaya sobre `surface`.
  correctFondo: '#10241B',
  wrongFondo: '#241C0C',

  /** Letra grande de un marcador de imagen/portada pendiente. */
  textSobrePortada: 'rgba(234, 242, 249, 0.22)',
  /** Oscurece una portada con imagen o degradado para que el texto lea. */
  veloPortada: 'rgba(9, 13, 19, 0.42)',
  /** Carril vacío de ProgressBar: más oscuro que la superficie que lo trae. */
  trackFondo: 'rgba(0, 0, 0, 0.38)',
  /** Velo del muro de desbloqueo, sobre el BlurView. */
  veloMuro: 'rgba(6, 9, 13, 0.72)',
  /** Velo de la barra de pestañas, sobre su BlurView. */
  veloBarra: 'rgba(20, 29, 40, 0.72)',
  /** Borde de la pastilla de pestaña activa. */
  accentBorde: 'rgba(69, 217, 255, 0.32)',
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

/**
 * Fondo de pantalla. Se aclara arriba, donde vive el sol, y se hunde
 * abajo. No está para verse: está para que las tarjetas floten.
 */
export const FONDO: [string, string] = ['#0E1620', color.bgFin];

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
  'rgba(69, 217, 255, 0.18)',
];

/** Filo de luz teñido de veredicto, para la banda de acierto/fallo. */
export const filoOk: [string, string, string] = [
  'rgba(255, 255, 255, 0.30)',
  'rgba(74, 222, 155, 0.10)',
  'rgba(74, 222, 155, 0.30)',
];
export const filoWrong: [string, string, string] = [
  'rgba(255, 255, 255, 0.30)',
  'rgba(242, 179, 61, 0.10)',
  'rgba(242, 179, 61, 0.30)',
];

/**
 * Las piezas de Dulces: contenido de juego, no marca (la excepción de `TINTES` del audit). Seis tintes, los
 * cinco de siempre (`calle`, `dia_a_dia`, `dinero`, `cultura`, `fonetica`) y `tech` para los niveles de seis
 * colores. Cada pieza es un degradado del MISMO tono (COLOR-2): el claro donde da el sol (arriba a la
 * izquierda), el medio y el oscuro. La luminosidad del medio (OKLCH ~0.55) es la que deja el símbolo blanco al
 * 70 % a 3.2:1 de contraste, para poder jugar solo con las formas (daltonismo); el croma y el tono son los de
 * `color.world`. Se calcularon en OKLCH con `luminosidad -0.07 / +0.06` alrededor del medio.
 */
export const pieza = {
  /** El símbolo de cada pieza: blanco al 70 %. */
  simbolo: 'rgba(255, 255, 255, 0.7)',
  /** El brillo del sol arriba a la izquierda: blanco que se apaga. */
  brillo: 'rgba(255, 255, 255, 0.26)',
  brilloFin: 'rgba(255, 255, 255, 0)',
  tintes: [
    { claro: '#BC7037', medio: '#A95E23', oscuro: '#924A03' },
    { claro: '#4D86CA', medio: '#3B73B6', oscuro: '#265EA0' },
    { claro: '#5F9043', medio: '#4E7E30', oscuro: '#3A691A' },
    { claro: '#887ACA', medio: '#7768B6', oscuro: '#6353A0' },
    { claro: '#848823', medio: '#737601', oscuro: '#5E6102' },
    { claro: '#00918E', medio: '#007E7B', oscuro: '#006765' },
  ],
} as const;

/** El resplandor del piso de Caída: del aire (arriba) al `accent` al 40 % (abajo). Nunca rojo ni ámbar: todavía no ha pasado nada. */
export const resplandorPiso: [string, string] = ['rgba(69, 217, 255, 0)', 'rgba(69, 217, 255, 0.4)'];

/** El sol del sistema, hecho visible como resplandor en `Screen`. */
export const resplandorSol: [string, string, string] = [
  'rgba(69, 217, 255, 0.16)',
  'rgba(69, 217, 255, 0.04)',
  'rgba(69, 217, 255, 0)',
];

/**
 * Señal (v5.0). Degradado dentro del mismo tono (COLOR-2): del cian hondo a la
 * luz. Sale de la escala del acento, no de hex nuevos.
 */
export const senal: [string, string, string] = [color.accent900, color.accent400, color.accent100];

/** Reflejo metálico que cruza el botón principal: blanco que aparece y se va. */
export const reflejo: [string, string, string] = [
  'rgba(255, 255, 255, 0)',
  'rgba(255, 255, 255, 0.38)',
  'rgba(255, 255, 255, 0)',
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
