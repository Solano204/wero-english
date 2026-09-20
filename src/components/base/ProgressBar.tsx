import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming } from 'react-native-reanimated';
import { color, radius, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/utils';

interface Props {
  value: number;
  total: number;
  tint?: string;
  height?: number;
}

/**
 * Barra de progreso animada.
 *
 * El mockup insiste en que la barra nunca retrocede: si el usuario falla
 * y la tarjeta se reinserta, la meta crece pero lo hecho no se pierde.
 * Por eso el ancho se calcula sobre `done`, no sobre `remaining`.
 */
export function ProgressBar({ value, total, tint = color.accent, height = 6 }: Props) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const progreso = useSharedValue(pct);
  const reducido = useMovimientoReducido();

  useEffect(() => {
    progreso.value = reducido
      ? pct
      : withTiming(pct, { duration: motionDuration.lento, easing: motionEasing.entrar });
  }, [pct, progreso, reducido]);

  // Solo transform: animar `width` fuerza layout nativo en cada cuadro.
  // El relleno queda a ancho completo y se recorta con scaleX desde la
  // izquierda, que es composición pura en el hilo de UI.
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: progreso.value }],
  }));

  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: tint, borderRadius: height, transformOrigin: 'left' },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    // Sobre tinta el carril tiene que ser más oscuro que la superficie
    // que lo contiene, no más claro: si no, la barra vacía parece llena.
    backgroundColor: color.trackFondo,
    overflow: 'hidden',
    width: '100%',
  },
  fill: { width: '100%', height: '100%' },
});

export const PROGRESS_RADIUS = radius.pill;
