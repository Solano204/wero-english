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

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',

  // Cian eléctrico. Sobre tinta se lee como una señal encendida, y deja
  // libres el ámbar para el fallo y el verde para el acierto.
  accent: '#45D9FF',
  accentSoft: 'rgba(69, 217, 255, 0.14)',
  accentDeep: '#17A8D4',

  // Texto encima del cian: tinta, no blanco. Blanco sobre cian no pasa
  // contraste y se ve lavado.
  onAccent: '#04141C',

  /** La única superficie de color. De contraste, no de tema. */
  contraste: '#0B3A50',
  onContraste: '#EAF7FD',

  correct: '#4ADE9B',
  correctSoft: 'rgba(74, 222, 155, 0.12)',
  correctDeep: '#22B87A',
  // El fallo es ámbar, nunca rojo: el usuario va a fallar cientos de
  // veces por diseño y cómo se siente eso decide si sigue en la semana 4.
  // Esta regla es anterior al rediseño y se mantiene intacta.
  wrong: '#F2B33D',
  wrongSoft: 'rgba(242, 179, 61, 0.12)',
  wrongDeep: '#C98F1F',

  riskWarn: '#F2B33D',
  riskWarnSoft: 'rgba(242, 179, 61, 0.12)',
  // El único rojo que queda, y solo para lenguaje explícito. Es el lugar
  // donde el rojo sí significa algo.
  riskStrong: '#FF7A66',
  riskStrongSoft: 'rgba(255, 122, 102, 0.12)',

  // Colores de mundo. Suben de luminancia respecto a la versión clara
  // para pasar contraste sobre tinta, pero se quedan un paso por debajo
  // del acento en saturación: el cian tiene que seguir siendo lo más
  // encendido de la pantalla.
  world: {
    dia_a_dia: '#5B9BE8',
    calle: '#F08A4B',
    dinero: '#4ADE9B',
    gente: '#E070C0',
    cultura: '#9B87F5',
    tech: '#3E9FBC',
    legal: '#8C97A6',
    fonetica: '#E0B441',
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

/** El sol del sistema, hecho visible como resplandor en `Screen`. */
export const resplandorSol: [string, string, string] = [
  'rgba(69, 217, 255, 0.16)',
  'rgba(69, 217, 255, 0.04)',
  'rgba(69, 217, 255, 0)',
];

/**
 * Degradados de portada. Tintados y oscuros, para que el texto claro
 * encima se lea sin necesidad de velo negro.
 */
export const gradiente: Record<string, [string, string]> = {
  calle: ['#3A2318', '#1B120D'],
  dinero: ['#123021', '#0B1A13'],
  dia_a_dia: ['#152740', '#0D1826'],
  gente: ['#33162B', '#1A0D17'],
  cultura: ['#241C40', '#130F21'],
  tech: ['#12303B', '#0A1B22'],
  legal: ['#1D2631', '#10161C'],
  fonetica: ['#33290F', '#1A1509'],
  neutro: ['#1B242F', '#111820'],
  azar:      ['#12303B', '#0A1B22'],
  gramatica: ['#1D2631', '#10161C'],
  oido:      ['#152740', '#0D1826'],
  sonidos:   ['#33290F', '#1A1509'],
  suena:     ['#12303B', '#0A1B22'],
  errores:   ['#33231F', '#1C1413'],
  atoran:    ['#33162B', '#1A0D17'],
  mazo:      ['#22301F', '#151C16'],
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

/** Botón circular de icono. */
export const iconoRedondo = {
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
  /** Halo del acento. Solo para la acción principal. */
  glow: {
    shadowColor: '#45D9FF',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
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
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  ipa: 'CharisSIL',
} as const;

export const duration = {
  instant: 120,
  fast: 180,
  base: 240,
  slow: 380,
  reveal: 520,
} as const;

export const layout = {
  tapMin: 48,
  cardMaxWidth: 520,
  screenPad: space.lg,
  /** Alto de la barra de anuncios. El tab bar se levanta esto. */
  adBar: 56,
} as const;

export type WorldId = keyof typeof color.world;
