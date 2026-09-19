import {
  Easing,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';

/**
 * Fuente única de movimiento.
 *
 * Todo lo que anima en la app (tarjetas, botones, listas) sale de aquí:
 * cambiar un valor lo cambia en todos lados a la vez, y evita que cada
 * componente invente su propia sensación de "rápido" o "con rebote".
 *
 * Nada de esto reemplaza `useMovimientoReducido()`: sigue siendo
 * responsabilidad de cada componente frenar o saltarse la animación
 * cuando el usuario pide menos movimiento.
 */

export const motionDuration = {
  /** Microinteracciones: prensados, pulsos, iconos. */
  rapida: 120,
  /** El grueso de las transiciones: tarjetas, bandas, listas. */
  normal: 220,
  /** Movimientos grandes o con más peso visual. */
  lenta: 350,
} as const;

export const motionEasing = {
  /** Desacelera al llegar: para todo lo que ENTRA. */
  salida: Easing.out(Easing.cubic),
  /** Acelera al irse: para todo lo que SALE. */
  entrada: Easing.in(Easing.cubic),
  /** Simétrica: para transiciones que no son ni entrada ni salida pura. */
  estandar: Easing.inOut(Easing.cubic),
} as const;

export const motionSpring = {
  /** Sin rebote, se asienta directo. Para progreso y transiciones grandes. */
  suave: { damping: 18, stiffness: 180, mass: 1 } satisfies WithSpringConfig,
  /** Rebote ligero. Para soltar un botón, una opción o una banda. */
  conRebote: { damping: 10, stiffness: 180, mass: 1 } satisfies WithSpringConfig,
  /** Firme y sin sobrepaso. Para el instante exacto de presionar. */
  firme: {
    damping: 22,
    stiffness: 300,
    mass: 0.8,
    overshootClamping: true,
  } satisfies WithSpringConfig,
};

/** Entrada suave genérica: fundido/desplazamiento con curva de salida. */
export function entrarSuave(to = 1) {
  'worklet';
  return withTiming(to, {
    duration: motionDuration.normal,
    easing: motionEasing.salida,
  });
}

/** Al presionar: firme, sin sobrepaso. */
export function presionar(to = 0.96) {
  'worklet';
  return withSpring(to, motionSpring.firme);
}

/** Al soltar: rebote ligero, nunca golpeado. */
export function rebote(to = 1) {
  'worklet';
  return withSpring(to, motionSpring.conRebote);
}
