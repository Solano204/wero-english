import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
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
} as const;

export const motionEasing = {
  /** Desacelera al llegar: todo lo que ENTRA o aparece. */
  entrar: Easing.out(Easing.cubic),
  /** Acelera al irse: todo lo que SALE o se pliega. */
  salir: Easing.in(Easing.cubic),
  /** Solo para bucles que van y vienen (esqueleto, respiro). */
  ciclo: Easing.inOut(Easing.ease),
} as const;

export const motionSpring = {
  /** Único preset: para lo que rebota a propósito (la banda de resultado, la pausa). */
  rebote: { damping: 10, stiffness: 180, mass: 1 } satisfies WithSpringConfig,
  // Transitorios: se van en "motion limpieza", cuando Button, AudioButton y
  // OptionButton pasen al feedback unificado.
  suave: { damping: 18, stiffness: 180, mass: 1 } satisfies WithSpringConfig,
  conRebote: { damping: 10, stiffness: 180, mass: 1 } satisfies WithSpringConfig,
};

/** Retraso entre elementos de una lista que entra: el mismo en todas. */
export const motionEscalon = {
  ms: 40,
  /** De aquí en adelante entran sin retraso: una lista larga no debe tardar. */
  max: 8,
} as const;

export function escalon(indice: number): number {
  return indice < motionEscalon.max ? indice * motionEscalon.ms : 0;
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

/** Fallo: sacudida horizontal de la pieza, entera dentro de `rapido`. */
export const motionSacudida = { oscilaciones: 3, amplitud: 6 } as const;

/** Bucles largos. */
export const motionCiclo = {
  esqueleto: 700,
  respiro: 900,
} as const;

/** Aparecer sin desplazarse: cambios de estado. */
export const aparecer = (retraso = 0) =>
  FadeIn.delay(retraso).duration(motionDuration.base).easing(motionEasing.entrar);

/** Aparecer subiendo: secciones y transiciones. */
export const aparecerSubiendo = (retraso = 0) =>
  FadeInDown.delay(retraso).duration(motionDuration.lento).easing(motionEasing.entrar);

/** Aparecer creciendo: fichas y tarjetas de resultado. */
export const aparecerZoom = (retraso = 0) =>
  ZoomIn.delay(retraso).duration(motionDuration.base).easing(motionEasing.entrar);

/** Salir: ease-in. */
export const desaparecer = (duracion: number = motionDuration.base) =>
  FadeOut.duration(duracion).easing(motionEasing.salir);

/** Reacomodo de elementos que cambian de lugar. */
export const reacomodar = () =>
  LinearTransition.duration(motionDuration.base).easing(motionEasing.entrar);
