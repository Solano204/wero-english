import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  color,
  font,
  layout,
  motionDuration,
  motionEasing,
  motionSpring,
  presionar,
  radius,
  rebote,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/utils';

export type OptionState = 'idle' | 'chosen' | 'correct' | 'wrong' | 'dimmed';

interface Props {
  label: string;
  state: OptionState;
  onPress: () => void;
  disabled?: boolean;
  index: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Opción de respuesta.
 *
 * Dos detalles que importan más de lo que parece:
 *  - Entra escalonada por índice, así el ojo baja en orden en vez de
 *    encontrarse cuatro cajas de golpe.
 *  - La incorrecta se sacude en horizontal, no se pone roja y ya. El
 *    movimiento comunica el fallo sin gritar.
 */
export function OptionButton({ label, state, onPress, disabled, index }: Props) {
  const enter = useSharedValue(0);
  const shake = useSharedValue(0);
  const press = useSharedValue(1);
  const pulse = useSharedValue(1);
  const reducido = useMovimientoReducido();

  useEffect(() => {
    enter.value = reducido
      ? withTiming(1, { duration: 0 })
      : withDelay(
          index * 30,
          withTiming(1, {
            duration: motionDuration.base,
            easing: motionEasing.entrar,
          })
        );
  }, [enter, reducido, index]);

  useEffect(() => {
    if (state === 'wrong' && !reducido) {
      // Corto y horizontal: comunica el fallo sin sentirse un regaño.
      shake.value = withSequence(
        withTiming(-7, { duration: 55 }),
        withTiming(7, { duration: 55 }),
        withTiming(-4, { duration: 55 }),
        withTiming(0, { duration: 55 })
      );
    }
    if (state === 'correct') {
      pulse.value = reducido
        ? 1
        : withSequence(
            withTiming(1.08, {
              duration: motionDuration.rapido,
              easing: motionEasing.entrar,
            }),
            withSpring(1, motionSpring.suave)
          );
    }
  }, [state, shake, pulse, reducido]);

  const anim = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (1 - enter.value) * 12 },
      { translateX: shake.value },
      { scale: press.value * pulse.value },
    ],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPressIn={() => {
        if (disabled) return;
        press.value = reducido ? 0.96 : presionar(0.96);
      }}
      onPressOut={() => {
        press.value = reducido ? 1 : rebote(1);
      }}
      style={[
        styles.base,
        stateStyles[state],
        { zIndex: 10 - index },
        anim,
      ]}
    >
      <Text style={[styles.label, textStyles[state]]}>{label}</Text>
    </AnimatedPressable>
  );
}

const stateStyles: Record<OptionState, object> = {
  idle: {
    backgroundColor: color.surface,
    borderColor: color.border,
  },
  chosen: {
    backgroundColor: color.surfaceHigh,
    borderColor: color.borderStrong,
  },
  correct: {
    backgroundColor: color.correctSoft,
    borderColor: color.correct,
  },
  wrong: {
    backgroundColor: color.wrongSoft,
    borderColor: color.wrong,
  },
  dimmed: {
    backgroundColor: color.surface,
    borderColor: color.border,
    opacity: 0.4,
  },
};

const textStyles: Record<OptionState, object> = {
  idle: { color: color.text },
  chosen: { color: color.text },
  correct: { color: color.correct, fontFamily: font.family.bodyStrong },
  wrong: { color: color.wrong, fontFamily: font.family.bodyStrong },
  dimmed: { color: color.textMuted },
};

const styles = StyleSheet.create({
  base: {
    minHeight: layout.tapMin + 8,
    borderRadius: radius.md,
    // Sin borde. La opcion se separa del fondo por su superficie, no
    // por un contorno: con cuatro en pantalla los contornos se leian
    // como una reja.
    borderWidth: 0,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    justifyContent: 'center',
  },
  label: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.4,
  },
});
