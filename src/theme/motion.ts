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
  /** El punto del mapa de la boca viaja despacio de la vocal española a la inglesa y se asienta sin rebote de más. */
  viaje: { duration: 900, dampingRatio: 0.75 } satisfies WithSpringConfig,
  /** La ruleta de partículas se asienta en la que queda al centro: rápida, con un asomo de rebote. */
  ruleta: { damping: 22, stiffness: 260, mass: 1 } satisfies WithSpringConfig,
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

/**
 * Colmena: lo que no cabe en la escala general. La onda de luz de una frase resuelta pasa de una ranura a la
 * siguiente en `ondaPaso` ms (sin pasar de `ondaTope` en total); los señuelos caen y se desvanecen en `cae` bajando
 * `caeDp`; al cambiar de ronda el panal sale en `salida` ms, cada contorno `salidaPaso` después del anterior.
 */
export const motionColmena = {
  ondaPaso: 30,
  ondaTope: 450,
  cae: 260,
  caeDp: 28,
  salida: 300,
  salidaPaso: 20,
} as const;

/**
 * Cázala: la casilla que se marca pulsa 1 → `casilla` → 1 y el retículo se cierra sobre el renglón desde
 * `reticulo` dp más afuera, en `rapido`. Las letras de una reducción que se transforma en su forma completa
 * cambian una tras otra con el escalón de las listas; el tramo de cada una dura `letra`.
 */
export const motionCaza = { casilla: 1.1, reticulo: 8, letra: 260 } as const;

/**
 * Gramática, «El error que se corrige»: cada palabra que cambia se tacha de izquierda a derecha en `tacha` ms (la
 * siguiente arranca con el escalón de las listas); tras la `pausa` la frase se transforma: lo que sobra sale y lo que
 * entra llega `entra` ms después, con el escalón entre una y otra.
 */
export const motionError = { tacha: motionDuration.base, pausa: 120, entra: 80 } as const;

/**
 * Modo oído: tras `bolsillo` ms sin tocar la pantalla baja el brillo de todo menos el anillo y la frase (el velo
 * oscurece `velo`, para OLED). El anillo se redibuja a lo sumo cada `cuadro` ms (60 fps) o cada `cuadroBolsillo` ms
 * (30 fps) en bolsillo.
 */
export const motionRadio = { bolsillo: 15000, velo: 0.6, cuadro: 16, cuadroBolsillo: 33 } as const;

/** Fallo: sacudida horizontal de la pieza, entera dentro de `base`. */
export const motionSacudida = { oscilaciones: 3, amplitud: 6 } as const;

/**
 * El mazo de Frases sueltas. El abanico de entrada abre las cartas de atrás (`abre`) y las junta (`junta`), con
 * `escalon` ms entre carta y carta: con tres cartas dura 220 + 320 + 2 × 60 = 660 ms, dentro de los 700. Una carta
 * lanzada sale en `lanzar`; el botón «Siguiente» la lanza como un deslizamiento de `velocidadBoton` dp/s.
 */
export const motionMazo = {
  abre: motionDuration.base,
  junta: motionDuration.lento,
  escalon: 60,
  lanzar: motionDuration.base,
  velocidadBoton: 1200,
  /** Grados que se abre cada carta de atrás en el abanico, y cuánto se separa hacia los lados (dp). */
  abanico: 6,
  separa: 12,
} as const;

/**
 * La señal que se rompe (detalle de Errores que te delatan). «Lo que dices» entra en `base`; el cable sale `cableInicio` ms
 * después y tarda `cable` en llegar a «Lo que entienden». A medio cable la señal hace interferencia: el cable vibra y se
 * pone ámbar en `interferencia`, y el texto que llega hace glitch durante `glitch` ms (cambia de posición a saltos, con
 * `glitchPasos` cuadros y hasta `glitchDesplazo` dp, y se asienta). El paso c («Lo correcto») arranca lo más tarde que
 * deje terminar todo dentro de `tope`, pero entre `cMin` y `cMax`.
 */
export const motionMalentendido = {
  cableInicio: 160,
  cable: motionDuration.lento,
  interferencia: motionDuration.rapido,
  glitch: 300,
  glitchPasos: 8,
  glitchDesplazo: 8,
  /** Cuánto vibra el cable: oscilaciones completas y su amplitud, en dp. */
  oscilaciones: 4,
  amplitud: 7,
  cMin: 480,
  cMax: 640,
  tope: 1600,
} as const;

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

/** Aparecer en `rapido`: el cambio de carta de Frases sueltas con reducir movimiento. */
export const aparecerRapido = () => FadeIn.duration(motionDuration.rapido).easing(motionEasing.entrar);

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

/** Cuánto viaja la frase de Modo oído al entrar y al salir (dp). */
const DESPLAZA_FRASE = 32;

/** Un bloque entra con un fundido subiendo 8 dp, en `lento` (los textos de una página que se abre). */
export const entraSube = (retraso = 0) =>
  new Keyframe({
    from: { opacity: 0, transform: [{ translateY: 8 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }], easing: motionEasing.entrar },
  })
    .duration(motionDuration.lento)
    .delay(retraso);

/** La frase nueva entra desde abajo con un fundido, en `lento`, cuando la anterior ya va saliendo. */
export const fraseEntra = () =>
  new Keyframe({
    from: { opacity: 0, transform: [{ translateY: DESPLAZA_FRASE }] },
    to: { opacity: 1, transform: [{ translateY: 0 }], easing: motionEasing.entrar },
  })
    .duration(motionDuration.lento)
    .delay(motionDuration.rapido);

/** La frase que se va sale hacia arriba con un fundido, en `base`. */
export const fraseSale = () =>
  new Keyframe({
    from: { opacity: 1, transform: [{ translateY: 0 }] },
    to: { opacity: 0, transform: [{ translateY: -DESPLAZA_FRASE }], easing: motionEasing.salir },
  }).duration(motionDuration.base);

/** Lo que sobra de la frase incorrecta sale subiendo 6 dp con un fundido, en `base`. */
export const saleArriba = () =>
  new Keyframe({
    from: { opacity: 1, transform: [{ translateY: 0 }] },
    to: { opacity: 0, transform: [{ translateY: -6 }], easing: motionEasing.salir },
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
