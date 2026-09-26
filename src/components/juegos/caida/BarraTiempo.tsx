import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { color, radius, space } from '@/theme';
import { avance, resplandor } from './medidas';

// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const APAGADO = color.textMuted;
const ACENTO = color.accent;

interface Props {
  /** La posición de la fila: el mismo valor que en la caída normal, que aquí solo cuenta el tiempo. */
  y: SharedValue<number>;
  distancia: number;
}

/**
 * Con «reducir movimiento» las fichas no caen: se quedan quietas arriba y el tiempo de la ronda (el
 * mismo, sale de `y`) es una barra fina que se vacía en `textMuted`. En el último tramo, el que en la
 * caída enciende el piso, pasa a `accent`: nunca ámbar ni rojo. Va en el hilo de UI, sin setState.
 */
export function BarraTiempo({ y, distancia }: Props) {
  const relleno = useAnimatedStyle(() => {
    const p = avance(y.value, distancia);
    return { width: `${(1 - p) * 100}%`, backgroundColor: resplandor(p) > 0 ? ACENTO : APAGADO };
  });

  return (
    <View style={styles.pista} accessible accessibilityRole="timer" accessibilityLabel="Tiempo de la ronda">
      <Animated.View style={[styles.relleno, relleno]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pista: {
    position: 'absolute',
    top: space.xs,
    left: space.lg,
    right: space.lg,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.trackFondo,
    overflow: 'hidden',
  },
  relleno: { height: '100%', borderRadius: radius.pill },
});
