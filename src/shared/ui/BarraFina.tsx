import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { color, motionDuration, motionEasing, radius } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** Alto de la barra: fina. */
const ALTO = 4;

interface Props {
  /** 0 a 1. */
  fraccion: number;
  /** El color del mundo (COLOR-1: permitido en una barra fina) o `accent`. */
  tinte: string;
  /** Se llena al pasar a true (cuando su sección entra a la vista). */
  activo: boolean;
  /** Retraso (ms) para escalonar varias barras: `escalon(i)`. */
  retraso?: number;
}

/**
 * Barra fina de progreso (4 dp) que se llena con `scaleX` al entrar a la vista, con su
 * retraso. Es decorativa: el número real va en el texto de quien la usa.
 */
export function BarraFina({ fraccion, tinte, activo, retraso = 0 }: Props) {
  const reducido = useMovimientoReducido();
  const progreso = useSharedValue(0);

  useEffect(() => {
    if (!activo) return;
    const meta = Math.min(1, Math.max(0, fraccion));
    progreso.set(reducido
      ? meta
      : withDelay(retraso, withTiming(meta, { duration: motionDuration.lento, easing: motionEasing.entrar })));
  }, [activo, fraccion, retraso, reducido, progreso]);

  const relleno = useAnimatedStyle(() => ({ transform: [{ scaleX: progreso.get() }] }));

  return (
    <View style={styles.carril} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.relleno, { backgroundColor: tinte }, relleno]} />
    </View>
  );
}

const styles = StyleSheet.create({
  carril: { height: ALTO, borderRadius: radius.pill, backgroundColor: color.trackFondo, overflow: 'hidden' },
  relleno: { width: '100%', height: '100%', borderRadius: radius.pill, transformOrigin: 'left' },
});
