import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aparecer, blur, color, font, layout, space, text } from '@/theme';

/** Alto del encabezado ya comprimido, debajo del safe area. */
const ALTO_BANDA = layout.tapMin + space.sm;
/** Cuánto más abajo vive el título grande antes de subir. */
const CAIDA = space.lg;
/** Scroll (dp) que tarda el título en pasar de grande a compacto. */
const RANGO = space.xxl;
const ESCALA_COMPACTA = font.size.xl / font.size.display;

/** Lo que el contenido debe dejar libre arriba (sin el safe area): título grande y aire. */
export const ALTO_ENCABEZADO = ALTO_BANDA + CAIDA + space.lg;

interface Props {
  titulo: string;
  scrollY: SharedValue<number>;
  /** Primera vez por sesión: el título abre la coreografía con un fundido. */
  entrada?: boolean;
  /** Lo que va a la derecha del título (p. ej. el chip de racha). */
  derecha?: ReactNode;
}

/**
 * Título grande que, al hacer scroll, se reduce y sube hasta un encabezado
 * compacto con banda de desenfoque (solo iOS; en Android, fondo sólido). Todo va
 * interpolado al scroll en el hilo de UI (transform y opacity), sin saltos.
 */
export function EncabezadoComprimido({ titulo, scrollY, entrada = false, derecha }: Props) {
  const { top } = useSafeAreaInsets();

  const banda = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, RANGO], [0, 1], Extrapolation.CLAMP),
  }));
  const fila = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, RANGO], [CAIDA, 0], Extrapolation.CLAMP) }],
  }));
  const tituloAnimado = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [0, RANGO], [1, ESCALA_COMPACTA], Extrapolation.CLAMP) }],
  }));

  return (
    <View pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.banda, { height: top + ALTO_BANDA }, banda]}>
        {Platform.OS === 'ios' ? (
          <>
            <BlurView intensity={blur.medio} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.velo]} />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.solida]} />
        )}
        <View style={styles.borde} />
      </Animated.View>
      <Animated.View entering={entrada ? aparecer() : undefined} pointerEvents="box-none">
        <Animated.View style={[styles.fila, { marginTop: top }, fila]} pointerEvents="box-none">
          <Animated.Text accessibilityRole="header" style={[styles.titulo, tituloAnimado]}>
            {titulo}
          </Animated.Text>
          {derecha ?? null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  banda: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  velo: { backgroundColor: color.veloBarra },
  solida: { backgroundColor: color.bgAlto },
  borde: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
  },
  fila: {
    height: ALTO_BANDA,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPad,
  },
  titulo: { ...text.display, transformOrigin: 'left center' },
});
