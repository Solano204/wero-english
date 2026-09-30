import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { nivelSeguidas } from '@/domain/seguidas';
import { color, motionDuration, motionEasing, motionSpring, senal } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

const ALTO_BARRA = 6;
const PUNTO = 12;
const HALO = 24;
/** Alto del resplandor de la barra cuando brilla: más alto que la barra, se desvanece hacia los lados. */
const ALTO_RESPLANDOR = 18;
/** Alto de la fila: lo que ocupa el halo del punto, para que nada se recorte. */
export const ALTO_BARRA_SESION = HALO;

/** Cuánto brilla cada escalón de aciertos seguidos (0 a 1). */
const BRILLO = [0, 0.16, 0.28, 0.42] as const;
/** Al subir de escalón el brillo se pasa un poco y se asienta. */
const PASO_ARRIBA = 0.2;
/** Cuánto crece el halo del punto con el brillo. */
const CRECE_HALO = 0.6;

interface Props {
  hecho: number;
  meta: number;
  /** Aciertos seguidos (ya en cero si el usuario apagó el contador). Enciende el brillo a los 3, 5 y 10. */
  seguidas?: number;
  /** Al terminar la sesión: una pasada de luz recorre la barra, una sola vez. */
  barrido?: boolean;
}

/** Ancho de la franja de luz de la pasada final. */
const BANDA = 72;

const acotar = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/**
 * Barra de la sesión de estudio: relleno en degradado `senal` y un punto de luz
 * en la punta. Relleno y punto salen del mismo valor con el mismo resorte, así
 * que viajan juntos. Solo `transform` y `opacity`: el relleno crece con scaleX
 * desde la izquierda (el degradado se comprime, y la punta siempre es la parte
 * clara). Con aciertos seguidos brilla por escalones; al fallar el brillo baja
 * con calma, sin sacudida ni mensaje.
 */
export function BarraSesion({ hecho, meta, seguidas = 0, barrido = false }: Props) {
  const reducido = useMovimientoReducido();
  const pasada = useSharedValue(0);
  const fraccion = meta > 0 ? Math.min(1, hecho / meta) : 0;
  const progreso = useSharedValue(fraccion);
  const ancho = useSharedValue(0);
  const brillo = useSharedValue(0);
  const nivel = nivelSeguidas(seguidas);
  const nivelPrevio = useRef(0);

  useEffect(() => {
    progreso.value = reducido ? fraccion : withSpring(fraccion, motionSpring.liquido);
  }, [fraccion, reducido, progreso]);

  useEffect(() => {
    const sube = nivel > nivelPrevio.current;
    nivelPrevio.current = nivel;
    const objetivo = BRILLO[nivel];
    if (reducido) {
      brillo.value = objetivo;
      return;
    }
    brillo.value = sube
      ? withSequence(
          withTiming(Math.min(1, objetivo + PASO_ARRIBA), { duration: motionDuration.rapido, easing: motionEasing.entrar }),
          withTiming(objetivo, { duration: motionDuration.lento, easing: motionEasing.salir })
        )
      : withTiming(objetivo, { duration: motionDuration.escena, easing: motionEasing.salir });
  }, [nivel, reducido, brillo]);

  useEffect(() => {
    pasada.value = barrido && !reducido ? withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar }) : 0;
  }, [barrido, reducido, pasada]);

  // La franja nace y muere en los bordes de la barra: sube a plena luz en el medio del recorrido.
  const luz = useAnimatedStyle(() => ({
    opacity: 1 - Math.abs(2 * pasada.value - 1),
    transform: [{ translateX: pasada.value * (ancho.value + BANDA) - BANDA }],
  }));
  const relleno = useAnimatedStyle(() => ({ transform: [{ scaleX: acotar(progreso.value) }] }));
  const resplandor = useAnimatedStyle(() => ({
    opacity: brillo.value,
    transform: [{ scaleX: acotar(progreso.value) }],
  }));
  const punto = useAnimatedStyle(() => ({
    transform: [{ translateX: acotar(progreso.value) * ancho.value - HALO / 2 }],
  }));
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: 1 + CRECE_HALO * brillo.value }] }));

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
      <Animated.View style={[styles.resplandor, resplandor]} pointerEvents="none">
        <LinearGradient
          colors={['transparent', color.accent, 'transparent']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={styles.pista}>
        <Animated.View style={[styles.relleno, relleno]}>
          <LinearGradient colors={senal} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[styles.pasada, luz]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', color.accent100, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <Animated.View style={[styles.contenedorPunto, punto]} pointerEvents="none">
        <Animated.View style={[styles.halo, halo]} />
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
  pasada: { position: 'absolute', top: 0, bottom: 0, left: 0, width: BANDA },
  resplandor: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (ALTO_BARRA_SESION - ALTO_RESPLANDOR) / 2,
    height: ALTO_RESPLANDOR,
    borderRadius: ALTO_RESPLANDOR / 2,
    overflow: 'hidden',
    transformOrigin: 'left',
  },
  contenedorPunto: {
    position: 'absolute',
    left: 0,
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    ...StyleSheet.absoluteFill,
    borderRadius: HALO / 2,
    backgroundColor: color.accentSoft,
  },
  punto: { width: PUNTO, height: PUNTO, borderRadius: PUNTO / 2, backgroundColor: color.accent100 },
});
