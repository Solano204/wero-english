import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { color, radius, space } from '@/theme';
import { avance, resplandor } from '@/features/juegos/caida/logic/medidas';
import { corrimientoRelleno, useAnchoRelleno } from '@/shared/ui/fx/rellenoBarra';

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
  const { ancho, alMedir } = useAnchoRelleno();
  const relleno = useAnimatedStyle(() => {
    const p = avance(y.get(), distancia);
    return {
      transform: [{ translateX: corrimientoRelleno(1 - p, ancho.get()) }],
      backgroundColor: resplandor(p) > 0 ? ACENTO : APAGADO,
    };
  });

  return (
    <View style={styles.pista} accessible accessibilityRole="timer" accessibilityLabel="Tiempo de la ronda">
      <Animated.View style={[styles.relleno, relleno]} onLayout={alMedir} />
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
  relleno: { width: '100%', height: '100%', borderRadius: radius.pill },
});
