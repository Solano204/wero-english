import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color, font, motionDuration, motionDulces, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';

/** Cuánto sube el chip mientras se desvanece. */
const SUBE = 28;

interface Props {
  /** «Cascada ×2», «Cascada ×3»…: sin exclamaciones. */
  texto: string;
  /** El chip ya se fue. */
  onFin: () => void;
}

/**
 * El chip que marca cada paso extra de una cascada: aparece sobre el tablero, sube y se desvanece en `chip`.
 * Quien lo usa le pone `key` distinta a cada uno para que se repita. Con «reducir movimiento» no sube: solo
 * aparece y se va con un fundido. Para el lector de pantalla se anuncia con el mismo texto.
 */
export function ChipCascada({ texto, onFin }: Props) {
  const reducido = useMovimientoReducido();
  const avance = useSharedValue(0);
  const visible = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(texto);
    const espera = Math.max(0, motionDulces.chip - motionDuration.rapido - motionDuration.base);
    visible.value = withSequence(
      withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withDelay(
        espera,
        withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir }, (terminada) => {
          'worklet';
          if (terminada) runOnJS(onFin)();
        })
      )
    );
    if (!reducido) avance.value = withTiming(1, { duration: motionDulces.chip, easing: motionEasing.entrar });
    // El chip se lanza una sola vez por montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estilo = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: -SUBE * avance.value }],
  }));

  return (
    <View pointerEvents="none" style={styles.centro}>
      <Animated.View style={[styles.chip, estilo]}>
        <Text style={styles.texto} maxFontSizeMultiplier={1.2}>
          {texto}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceHigh,
    borderWidth: 1,
    borderColor: color.accent,
  },
  texto: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.accent },
});
