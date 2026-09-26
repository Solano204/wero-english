import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  Keyframe,
  LinearTransition,
  ZoomIn,
  type WithSpringConfig,
} from 'react-native-reanimated';

/**
 * Fuente única de movimiento (MOT-1).
 *
 * Ninguna duración, curva ni spring vive fuera de este archivo: cambiar un
 * valor lo cambia en toda la app y nadie inventa su propia idea de "rápido".
 * Solo se anima `transform` y `opacity` (y `height` en los plegables).
 *
 * Con "reducir movimiento" Reanimated salta las animaciones al valor final
 * (`ReduceMotion.System`, su valor por omisión); lo que no es Reanimated
 * (escala al presionar, sacudida, partículas) lo frena cada componente con
 * `useMovimientoReducido()`.
 */

export const motionDuration = {
  /** Feedback al tocar. */
  rapido: 150,
  /** Cambios de estado: aparecer, resaltar, resolver. */
  base: 220,
  /** Transiciones, secciones que entran y plegables. */
  lento: 320,
  /** Una escena que cambia: la tarjeta HOY que se expande a pantalla completa. */
  escena: 450,
  /** Tope de la coreografía de entrada de una pantalla, de la primera pieza a la última. */
  coreografia: 900,
} as const;

export const motionEasing = {
  /** Desacelera al llegar: todo lo que ENTRA o aparece. */
  entrar: Easing.out(Easing.cubic),
  /** Acelera al irse: todo lo que SALE o se pliega. */
  salir: Easing.in(Easing.cubic),
  /** Solo para bucles que van y vienen (esqueleto, respiro). */
  ciclo: Easing.inOut(Easing.ease),
  /** Solo para dirigir una animación por tramos (cada pieza aplica su propia curva). */
  lineal: Easing.linear,
} as const;

export const motionSpring = {
  /** Único preset: para lo que rebota a propósito (la banda de resultado, la pausa). */
  rebote: { damping: 10, stiffness: 180, mass: 1 } satisfies WithSpringConfig,
  /** La píldora de la barra de pestañas: llega con holgura, sin rebote de más. */
  liquido: { damping: 16, stiffness: 190, mass: 1.1 } satisfies WithSpringConfig,
  /** La aguja del medidor se asienta en `duration` ms, con rebote: por eso el total de su entrada es fijo. */
  aguja: { duration: 550, dampingRatio: 0.55 } satisfies WithSpringConfig,
};

/**
 * El veredicto de Estudio dentro de la pieza. Las palabras de una frase armada se
 * iluminan una tras otra (`palabra` ms entre cada una, hasta `maxPalabras`: una
 * frase larga no tarda más de ~600 ms) y las letras de un dictado, igual.
 */
export const motionVeredicto = { palabra: 60, maxPalabras: 10 } as const;

/** Retraso entre elementos de una lista que entra: el mismo en todas. */
export const motionEscalon = {
  ms: 40,
  /** Del elemento 9 en adelante el retraso se queda en el del 8: el orden se respeta y la lista no tarda. */
  max: 8,
} as const;

export function escalon(indice: number): number {
  return Math.min(indice, motionEscalon.max - 1) * motionEscalon.ms;
}

/** Vida de las partículas (no son transiciones de interfaz). */
export const motionEfecto = {
  trozos: 620,
  trozosEscalon: 8,
  confeti: 1500,
  confetiEscalon: 45,
} as const;

/** Feedback al presionar (`Presionable`). */
export const motionPresion = {
  escala: 0.97,
  /** Con "reducir movimiento" no hay escala: baja la opacidad. */
  opacidad: 0.7,
} as const;

/** Acierto: pulso de la pieza (1 → escala → 1 en `base`). */
export const motionPulso = { escala: 1.04 } as const;

/**
 * Un logro en el mapa de niveles (Niveles): la celda pulsa 1 → `escala` → 1 y sus estrellas
 * nuevas se encienden una por una, `entreEstrellas` ms una de otra (con un destello dorado).
 * La cascada de entrada de las estrellas de un tramo usa `cascada`.
 */
export const motionLogro = { escala: 1.06, entreEstrellas: 160, cascada: 60 } as const;

/**
 * El ritmo de una jugada de Dulces, paso a paso: las piezas que forman línea pulsan (`pulso`) y se van
 * (`estallido`) mientras sus trozos vuelan a la barra de su meta (`vuelo`); las de arriba caen con
 * aceleración (`caidaBase` más `caidaPorFila` por cada fila que bajan) y rebotan un poco al aterrizar
 * (`reboteDp` de alto, `reboteMs` de duración); cada paso extra de la cascada muestra su chip (`chip`).
 * El intercambio usa `motionDuration.base` y el rebarajado `lento`.
 */
export const motionDulces = {
  pulso: 120,
  estallido: 140,
  vuelo: 320,
  caidaBase: 120,
  caidaPorFila: 40,
  reboteDp: 4,
  reboteMs: 100,
  chip: 700,
} as const;

/** Fallo: sacudida horizontal de la pieza, entera dentro de `base`. */
export const motionSacudida = { oscilaciones: 3, amplitud: 6 } as const;

/** Bucles largos. */
export const motionCiclo = {
  esqueleto: 700,
  respiro: 900,
} as const;

/**
 * Señal en vivo (v5.0). Bucles y momentos de la consola de audio. Todo bucle se
 * pausa fuera de pantalla, sin foco o en segundo plano (MOT-4) y con "reducir
 * movimiento" queda en su estado final (MOT-5).
 */
export const motionSenal = {
  /** La onda de HOY inhala y exhala. */
  respiro: 4000,
  /** Un ciclo completo de la aurora del fondo. */
  aurora: 20000,
  /** Cada cuánto cruza el reflejo por el botón principal. */
  reflejo: 6000,
  /** Recorrido del reflejo dentro de ese ciclo. */
  reflejoPaso: 700,
  /** Microruido de la onda al tocar HOY. */
  interferencia: 120,
  /** El anillo de meta se llena de 0 a su valor. */
  anillo: 900,
  /** Cada columna del marcador rueda hasta su dígito. */
  marcador: 700,
  /** Onda expansiva que sale del dedo. */
  onda: 600,
  /** Bucle corto de las portadas de juego. */
  portada: 3200,
  /** Los segmentos del medidor VU se encienden de izquierda a derecha en este total. */
  medidor: 600,
  /** La aguja sube hasta pasarse un poco del valor; después se asienta con `motionSpring.aguja`. */
  aguja: 350,
  /** Un ciclo del temblor casi imperceptible de la aguja en reposo. */
  temblor: 3000,
  /** Las columnas del espectrograma suben de izquierda a derecha en este total. */
  espectro: 600,
  /** Retraso entre una columna y la siguiente. */
  columna: 20,
  /** Cada cuánto se lee la posición del audio para la onda de voz y el karaoke (solo mientras suena). */
  muestreo: 50,
  /** El anillo del nivel actual emite una onda cada 2.4 s (Niveles: el único bucle de la pantalla). */
  ondaNivel: 2400,
  /** El reloj de Pares late suave en `accent` durante su último 20 %. */
  latido: 1200,
  /** El cursor de la ranura que sigue, en Colmena, respira una vez. */
  cursor: 1600,
} as const;

/**
 * Coreografía de entrada de Practicar (solo la primera vez por sesión). Cada
 * pieza arranca en su retraso y todas cierran antes de `motionDuration.coreografia`.
 */
export const motionEntrada = {
  hoy: 100,
  onda: 350,
  chips: 450,
  destacados: 500,
  /** Progreso: los chips y el espectrograma entran mientras la aguja termina de asentarse. */
  chipsProgreso: 350,
  espectro: 300,
  /** Detalle: la escala de registro, luego «Cuándo no decirla» y luego el contexto (cada uno dura `lento`). */
  detalleRegistro: 200,
  detalleAviso: 350,
  detalleContexto: 500,
} as const;

/** Aparecer sin desplazarse: cambios de estado. */
export const aparecer = (retraso = 0) =>
  FadeIn.delay(retraso).duration(motionDuration.base).easing(motionEasing.entrar);

/** Aparecer subiendo: secciones y transiciones. */
export const aparecerSubiendo = (retraso = 0) =>
  FadeInDown.delay(retraso).duration(motionDuration.lento).easing(motionEasing.entrar);

/** Una pieza que salta a su lugar con el resorte de `rebote` (una ficha que entra a la frase que se arma). */
export const entrarRebote = () =>
  ZoomIn.springify()
    .damping(motionSpring.rebote.damping)
    .stiffness(motionSpring.rebote.stiffness)
    .mass(motionSpring.rebote.mass);

/** Cuánto viaja una tarjeta al entrar y al salir (dp): un empujón, no cruzar la pantalla. */
const DESPLAZA_TARJETA = 48;

/** La tarjeta nueva entra desde la derecha con un fundido, en `lento`. */
export const tarjetaEntra = () =>
  new Keyframe({
    from: { opacity: 0, transform: [{ translateX: DESPLAZA_TARJETA }] },
    to: { opacity: 1, transform: [{ translateX: 0 }], easing: motionEasing.entrar },
  }).duration(motionDuration.lento);

/** La tarjeta que se va sale hacia la izquierda con un fundido, en `base`. */
export const tarjetaSale = () =>
  new Keyframe({
    from: { opacity: 1, transform: [{ translateX: 0 }] },
    to: { opacity: 0, transform: [{ translateX: -DESPLAZA_TARJETA }], easing: motionEasing.salir },
  }).duration(motionDuration.base);

/** Aparecer creciendo: fichas y tarjetas de resultado. */
export const aparecerZoom = (retraso = 0) =>
  ZoomIn.delay(retraso).duration(motionDuration.base).easing(motionEasing.entrar);

/** Salir: ease-in. */
export const desaparecer = (duracion: number = motionDuration.base) =>
  FadeOut.duration(duracion).easing(motionEasing.salir);

/** Reacomodo de elementos que cambian de lugar. */
export const reacomodar = () =>
  LinearTransition.duration(motionDuration.base).easing(motionEasing.entrar);
