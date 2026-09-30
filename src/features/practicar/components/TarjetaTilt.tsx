import React, { useMemo, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { inclinacion, motionDuration, motionSpring } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Inclina en 3D lo que envuelve mientras se mantiene presionado, siguiendo el
 * dedo (máximo `inclinacion.maxGrados`), y regresa con resorte al soltar. El
 * toque corto sigue siendo del hijo (`Presionable`): el gesto solo se activa
 * tras la pulsación larga y entonces cancela el toque. Con "reducir movimiento"
 * no hay inclinación.
 */
export function TarjetaTilt({ children, style }: Props) {
  const reducido = useMovimientoReducido();
  const ancho = useSharedValue(1);
  const alto = useSharedValue(1);
  const giroX = useSharedValue(0);
  const giroY = useSharedValue(0);

  const gesto = useMemo(() => {
    const seguir = (x: number, y: number) => {
      'worklet';
      const nx = Math.max(-1, Math.min(1, (x - ancho.get() / 2) / (ancho.get() / 2)));
      const ny = Math.max(-1, Math.min(1, (y - alto.get() / 2) / (alto.get() / 2)));
      giroY.set(nx * inclinacion.maxGrados);
      giroX.set(-ny * inclinacion.maxGrados);
    };
    return Gesture.Pan()
      .enabled(!reducido)
      .activateAfterLongPress(motionDuration.lento)
      .onStart((e) => seguir(e.x, e.y))
      .onUpdate((e) => seguir(e.x, e.y))
      .onFinalize(() => {
        giroX.set(withSpring(0, motionSpring.rebote));
        giroY.set(withSpring(0, motionSpring.rebote));
      });
  }, [reducido, ancho, alto, giroX, giroY]);

  const estilo = useAnimatedStyle(() => ({
    transform: [
      { perspective: inclinacion.perspectiva },
      { rotateX: `${giroX.get()}deg` },
      { rotateY: `${giroY.get()}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View
        style={[style, estilo]}
        onLayout={(e) => {
          ancho.set(e.nativeEvent.layout.width);
          alto.set(e.nativeEvent.layout.height);
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
