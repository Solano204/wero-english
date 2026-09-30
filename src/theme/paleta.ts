/**
 * Tokens de diseño. Ningún componente define colores ni medidas propias:
 * todo sale de aquí para que un cambio de paleta sea un cambio de archivo.
 *
 * v6.0: Cobalto nocturno.
 *
 * Wero enseña el inglés que no está en los libros: jerga de calle, AAVE,
 * hip-hop, oficina. Ese idioma se aprende de oído y vive de noche. La
 * identidad son tres colores y nada más: negro (una tinta casi negra, no
 * #000), blanco (un blanco frío, no #FFF) y un solo azul cobalto. Sobria,
 * premium y sin arcoíris: el azul es lo único que brilla.
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
 * 3. El acento es azul, no ámbar. Y es una restricción del producto,
 *    no un gusto: el ámbar ya está ocupado por el FALLO, y por muy buena
 *    razón (ver `wrong`). Si la marca fuera ámbar, el color de "te
 *    equivocaste" sería el color de la app.
 *
 * 4. El fondo es un degradado, no un color plano. Se aclara arriba, donde
 *    está el sol, y se hunde abajo. Es sutil a propósito: lo que hace no
 *    es verse, es que las tarjetas floten.
 *
 * 5. Hay una sola superficie de color en toda la app, y es de contraste,
 *    no de tema: la tarjeta de "tu sesión de hoy" (`contraste`, un azul
 *    marino hondo). Una sola, o deja de resaltar.
 *
 * El azul tiene DOS versiones, porque ningún azul sirve para las dos cosas:
 * `primario` (#1F5BFF, relleno de botón con texto claro encima: 4.85:1) y
 * `accent` (#6D9BFF, texto e ícono sobre el fondo oscuro: 6.04:1 o más). La
 * tabla de contrastes completa está en DESIGN.md.
 */

export const color = {
  // Fondos. Tinta casi negra con un punto de azul, no negro puro: el negro
  // absoluto produce halo en paneles OLED y hace que el texto claro vibre en
  // sesiones largas.
  bg: '#07080B',
  /** Abajo del degradado. La parte honda. */
  bgFin: '#040507',
  bgAlto: '#0B0C10',
  surface: '#0F1116',
  surfaceAlt: '#161A21',
  surfaceHigh: '#1C202A',
  surfaceSolida: '#0F1116',
  /** `surface` sin opacidad: el extremo transparente de un degradado que se funde con ella (el final de una fila recortada). */
  surfaceSinAlfa: 'rgba(15, 17, 22, 0)',

  // Texto. Blanco frío, no blanco puro: el #FFF sobre tinta vibra y cansa
  // igual que el negro sobre papel blanco.
  //
  // textFaint se aclaró de #717A8A (daba 3.76:1 sobre surfaceHigh) a #7F8899
  // (4.56:1). Todos los pares de texto pasan 4.5:1 sobre las superficies; ver
  // la tabla de contrastes en DESIGN.md.
  text: '#F4F6FA',
  textMuted: '#A9B1BF',
  textFaint: '#7F8899',

  // Escala 50–900 de los neutros (COLOR-3), grises fríos. Los pasos 50, 200,
  // 300, 700, 800 y 900 son `text`, `textMuted`, `textFaint`, `surfaceHigh`,
  // `surface` y `bg`; el resto está interpolado entre ellos.
  neutral50: '#F4F6FA',
  neutral100: '#CED3DC',
  neutral200: '#A9B1BF',
  neutral300: '#7F8899',
  neutral400: '#5E6574',
  neutral500: '#4E5462',
  neutral600: '#3D434F',
  neutral700: '#1C202A',
  neutral800: '#0F1116',
  neutral900: '#07080B',

  border: '#222733',
  borderStrong: '#434957',

  // Azul cobalto, la versión para texto e íconos sobre el fondo oscuro (el
  // relleno de botón es `primario`, más hondo). Deja libres el ámbar para el
  // fallo y el verde para el acierto.
  accent: '#6D9BFF',
  accentSoft: 'rgba(31, 91, 255, 0.16)',
  // La línea de abajo de una ficha elegida (TileBuilder). Igual que `accent`:
  // pasa 4.5:1 sobre todas las superficies.
  accentDeep: '#6D9BFF',
  // Escala 50–900 del acento (COLOR-3). El 400 es el azul de relleno
  // (`primario`), el 900 y el 100 los extremos de `senal`; los demás salen de
  // la misma familia en OKLCH.
  accent50: '#DCE6FE',
  accent100: '#BFD2FF',
  accent200: '#8DAEFE',
  accent300: '#5989FC',
  accent400: '#1F5BFF',
  accent500: '#1B4DD5',
  accent600: '#1740AC',
  accent700: '#133385',
  accent800: '#0F2760',
  accent900: '#0B1A3D',

  // Texto encima de `accent` (el azul claro, en rellenos chicos: una ficha, una
  // casilla): tinta, 7.42:1. Sobre el azul de relleno va `onPrimario`.
  onAccent: '#07080B',

  /** La única superficie de color, la tarjeta HOY: azul marino hondo. De contraste, no de tema. */
  contraste: '#0B1A3D',
  onContraste: '#F4F6FA',
  // Escala 50–900 del primario (COLOR-3). El 800 es `contraste`.
  contraste50: '#E0E8FA',
  contraste100: '#C9D6F2',
  contraste200: '#92A8D6',
  contraste300: '#5E7BBA',
  contraste400: '#2D4E9C',
  contraste500: '#244081',
  contraste600: '#1B3267',
  contraste700: '#13254E',
  contraste800: '#0B1A3D',
  contraste900: '#050D21',

  correct: '#3DDC97',
  correctSoft: 'rgba(61, 220, 151, 0.12)',
  correctDeep: '#1FAC6F',
  // El fallo es ámbar, nunca rojo: el usuario va a fallar cientos de
  // veces por diseño y cómo se siente eso decide si sigue en la semana 4.
  // Esta regla es anterior al rediseño y se mantiene intacta.
  wrong: '#F5B942',
  wrongSoft: 'rgba(245, 185, 66, 0.12)',
  wrongDeep: '#D99A1E',

  // Estrellas y aciertos seguidos. Dorado, 11.30:1 o más sobre las superficies.
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

  // Colores de mundo (COLOR-1). Con una identidad de tres colores los mundos
  // no pueden ser un arcoíris: son una escala de azules (el tono del acento,
  // de OKLCH L 0.64 a 0.92), y lo que distingue a un mundo de otro es su
  // ícono (`ICONO_MUNDO`, lo pinta `PuntoMundo`), no el color. Todos pasan
  // 4.5:1 sobre las superficies. Van en chico: el ícono, una etiqueta y una
  // barra fina; nunca en fondos grandes ni en botones. Las piezas de Dulces
  // no llevan estos tintes: usan `dulce` (ver más abajo).
  world: {
    dia_a_dia: '#5686F2',
    calle: '#6794F6',
    dinero: '#79A2F9',
    gente: '#8BB0FD',
    cultura: '#9EBDFD',
    tech: '#B2CBFD',
    legal: '#C4D8FF',
    fonetica: '#D8E5FE',
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
  velo: 'rgba(7, 8, 11, 0.94)',

  /** Filo iluminado: el canto de arriba de una superficie. */
  filo: 'rgba(255, 255, 255, 0.14)',

  // Fondos de banda de FeedbackBand: una versión hundida del color de
  // veredicto, para que el texto de acierto/fallo no vaya sobre `surface`.
  correctFondo: '#0B1715',
  wrongFondo: '#18140F',

  /** Letra grande de un marcador de imagen/portada pendiente. */
  textSobrePortada: 'rgba(244, 246, 250, 0.22)',
  /** Oscurece una portada con imagen o degradado para que el texto lea. */
  veloPortada: 'rgba(7, 8, 11, 0.42)',
  /** Carril vacío de ProgressBar: más oscuro que la superficie que lo trae. */
  trackFondo: 'rgba(0, 0, 0, 0.42)',
  /** Velo del muro de desbloqueo, sobre el BlurView. */
  veloMuro: 'rgba(7, 8, 11, 0.74)',
  /** Velo de la barra de pestañas, sobre su BlurView. */
  veloBarra: 'rgba(15, 17, 22, 0.74)',
  /** Borde de la pastilla de pestaña activa. */
  accentBorde: 'rgba(109, 155, 255, 0.32)',
  /** Canto inferior de una pieza de juego, para el efecto de relieve. */
  biselSombra: 'rgba(0, 0, 0, 0.45)',
  /** shadowColor genérico: mismo negro que ya usa `shadow`, con nombre. */
  shadow: '#000000',
  /**
   * Tinte del ícono de notificación en Android (el `color` del plugin de
   * expo-notifications en app.json y el `lightColor` del canal): el azul de
   * relleno. Si cambia, cambia también en app.json.
   */
  notifAndroid: '#1F5BFF',

  // ── Bloques: lo que se pinta con el azul de relleno o con el de texto ──
  /** Relleno de la acción principal (botón primario, botón de ícono de acento, el círculo del reproductor). */
  primario: '#1F5BFF',
  /** Texto e ícono sobre `primario`. */
  onPrimario: '#F4F6FA',
  /** Ícono y etiqueta de la pestaña activa, y de las inactivas. */
  barraActivo: '#6D9BFF',
  barraInactivo: '#747E8E',
  /** Fondo de la pastilla de la pestaña activa. */
  pastilla: 'rgba(109, 155, 255, 0.18)',
  /** La hoja de veredicto de un acierto y su texto. */
  hojaAcierto: '#0B1715',
  onHojaAcierto: '#3DDC97',
  /** Los tres pasos del degradado `senal` (del hondo a la luz). */
  senalInicio: '#0B1A3D',
  senalMedio: '#1F5BFF',
  senalFin: '#BFD2FF',
  /** El degradado neutro de las portadas sin imagen (`gradiente.neutro`). */
  portadaInicio: '#131B2B',
  portadaFin: '#0C0F15',
} as const;

/** Paleta oscura: las barras del sistema van con íconos claros. */
export const tema = { claro: false } as const;

export type WorldId = keyof typeof color.world;
