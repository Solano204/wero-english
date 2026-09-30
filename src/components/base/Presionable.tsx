import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motionDuration, motionEasing, motionPresion } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import { useValoresResultado, type Resultado } from '@/components/feedback/useEfectoResultado';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Feedback al presionar: la ÚNICA forma en la app.
 *
 * Escala 0.97 en `rapido`. Con "reducir movimiento" no hay escala: solo baja
 * la opacidad mientras el dedo está encima.
 *
 * Si la pieza recibe un `resultado`, además hace el pulso de acierto o la
 * sacudida de fallo (`useEfectoResultado`): todo en una sola transformación.
 */
export function usePresion(resultado?: Resultado | null) {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(1);
  const [abajo, setAbajo] = useState(false);
  const { dx, pulso, disparar } = useValoresResultado();

  useEffect(() => {
    disparar(resultado);
  }, [resultado, disparar]);

  const animado = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { scale: escala.value * pulso.value }],
  }));

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

/**
 * Sin `entering`, `exiting` ni `layout`: la escala de `Presionable` es un `transform` animado en su propio nodo y una
 * animación de layout en ese mismo nodo lo pisa (Reanimated avisa «Property "transform" … may be overwritten»). Quien
 * necesite entrar, salir o reacomodarse envuelve el `Presionable` en un `Animated.View` con esa animación.
 */
type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Acierto: pulso. Fallo: sacudida. El color lo pone quien la usa. */
  resultado?: Resultado | null;
};

/** `Pressable` con el feedback unificado. */
export function Presionable({ style, resultado, onPressIn, onPressOut, ...resto }: Props) {
  const { estilo, alPresionar, alSoltar } = usePresion(resultado);
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
