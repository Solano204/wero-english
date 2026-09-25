import React, { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { color, motionSpring, senal } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const ALTO_BARRA = 6;
const PUNTO = 12;
const HALO = 24;
/** Alto de la fila: lo que ocupa el halo del punto, para que nada se recorte. */
export const ALTO_BARRA_SESION = HALO;

interface Props {
  hecho: number;
  meta: number;
}

const acotar = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/**
 * Barra de la sesión de estudio: relleno en degradado `senal` y un punto de luz
 * en la punta. Relleno y punto salen del mismo valor con el mismo resorte, así
 * que viajan juntos. Solo `transform`: el relleno crece con scaleX desde la
 * izquierda (el degradado se comprime, y la punta siempre es la parte clara).
 */
export function BarraSesion({ hecho, meta }: Props) {
  const reducido = useMovimientoReducido();
  const fraccion = meta > 0 ? Math.min(1, hecho / meta) : 0;
  const progreso = useSharedValue(fraccion);
  const ancho = useSharedValue(0);

  useEffect(() => {
    progreso.value = reducido ? fraccion : withSpring(fraccion, motionSpring.liquido);
  }, [fraccion, reducido, progreso]);

  const relleno = useAnimatedStyle(() => ({ transform: [{ scaleX: acotar(progreso.value) }] }));
  const punto = useAnimatedStyle(() => ({
    transform: [{ translateX: acotar(progreso.value) * ancho.value - HALO / 2 }],
  }));

  const alMedir = (e: LayoutChangeEvent) => {
    ancho.value = e.nativeEvent.layout.width;
  };

  return (
    <View
      style={styles.fila}
      onLayout={alMedir}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Progreso de la sesión"
      accessibilityValue={{ min: 0, max: Math.max(meta, 1), now: Math.min(hecho, Math.max(meta, 1)) }}
    >
      <View style={styles.pista}>
        <Animated.View style={[styles.relleno, relleno]}>
          <LinearGradient colors={senal} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.halo, punto]} pointerEvents="none">
        <View style={styles.punto} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { height: ALTO_BARRA_SESION, justifyContent: 'center' },
  pista: {
    height: ALTO_BARRA,
    borderRadius: ALTO_BARRA,
    backgroundColor: color.trackFondo,
    overflow: 'hidden',
  },
  relleno: { ...StyleSheet.absoluteFill, transformOrigin: 'left' },
  halo: {
    position: 'absolute',
    left: 0,
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accentSoft,
  },
  punto: { width: PUNTO, height: PUNTO, borderRadius: PUNTO / 2, backgroundColor: color.accent100 },
});
