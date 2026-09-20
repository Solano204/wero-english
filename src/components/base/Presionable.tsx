import React, { useCallback, useState, type ComponentProps } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motionDuration, motionEasing, motionPresion } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Feedback al presionar: la ÚNICA forma en la app.
 *
 * Escala 0.97 en `rapido`. Con "reducir movimiento" no hay escala: solo baja
 * la opacidad mientras el dedo está encima.
 */
export function usePresion() {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(1);
  const [abajo, setAbajo] = useState(false);

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  const alPresionar = useCallback(() => {
    if (reducido) {
      setAbajo(true);
      return;
    }
    escala.value = withTiming(motionPresion.escala, {
      duration: motionDuration.rapido,
      easing: motionEasing.entrar,
    });
  }, [reducido, escala]);

  const alSoltar = useCallback(() => {
    if (reducido) {
      setAbajo(false);
      return;
    }
    escala.value = withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar });
  }, [reducido, escala]);

  const estilo = [animado, reducido && abajo ? { opacity: motionPresion.opacidad } : null];
  return { estilo, alPresionar, alSoltar };
}

type Props = Omit<PressableProps, 'style'> &
  Pick<ComponentProps<typeof Animated.View>, 'entering' | 'exiting' | 'layout'> & {
    style?: StyleProp<ViewStyle>;
  };

/** `Pressable` con el feedback unificado. Acepta también `entering`, `exiting` y `layout`. */
export function Presionable({ style, onPressIn, onPressOut, ...resto }: Props) {
  const { estilo, alPresionar, alSoltar } = usePresion();
  return (
    <AnimatedPressable
      {...resto}
      onPressIn={(e) => {
        alPresionar();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        alSoltar();
        onPressOut?.(e);
      }}
      style={[style, estilo]}
    />
  );
}
