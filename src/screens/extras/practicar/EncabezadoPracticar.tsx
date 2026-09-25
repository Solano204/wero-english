import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/base';
import { blur, color, font, layout, radius, space, text } from '@/theme';

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
  scrollY: SharedValue<number>;
  racha: number;
}

function ChipRacha({ dias }: { dias: number }) {
  return (
    <View
      style={styles.chip}
      accessible
      accessibilityLabel={`Racha: ${dias} ${dias === 1 ? 'día' : 'días'}`}
    >
      <Icon name="fire" size="md" color={color.star} />
      <Text style={styles.chipNumero}>{dias}</Text>
    </View>
  );
}

/**
 * «Practicar» grande que, al hacer scroll, se reduce y sube hasta un encabezado
 * compacto con banda de desenfoque. Todo va interpolado al scroll en el hilo de
 * UI (transform y opacity), sin saltos. A la derecha, el chip de racha.
 */
export function EncabezadoPracticar({ scrollY, racha }: Props) {
  const { top } = useSafeAreaInsets();

  const banda = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, RANGO], [0, 1], Extrapolation.CLAMP),
  }));
  const fila = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, RANGO], [CAIDA, 0], Extrapolation.CLAMP) }],
  }));
  const titulo = useAnimatedStyle(() => ({
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
      <Animated.View style={[styles.fila, { marginTop: top }, fila]} pointerEvents="box-none">
        <Animated.Text accessibilityRole="header" style={[styles.titulo, titulo]}>
          Practicar
        </Animated.Text>
        {racha > 0 ? <ChipRacha dias={racha} /> : null}
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  chipNumero: {
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.md,
    fontVariant: ['tabular-nums'],
    color: color.star,
  },
});
