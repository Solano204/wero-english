import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { BordePunteado } from '@/components/fx/BordePunteado';
import { Icon } from '@/components/base/Icon';
import { color, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { Rect } from './geometria';

interface Props {
  recta: Rect;
  /** Retraso (ms) de la aparición: en el cierre del tablero los sellos entran escalonados. */
  retraso?: number;
}

/**
 * Lo que queda donde estuvo una ficha cuyo par ya se juntó: un borde punteado y una
 * palomita en `textFaint`. Es un hueco «cumplido», no una ficha apagada: el tablero no se
 * mueve y se lee de un vistazo cuánto falta. Decorativo: el progreso lo dice el
 * `progressbar` de arriba.
 */
export function Sello({ recta, retraso = 0 }: Props) {
  const reducido = useMovimientoReducido();
  const presencia = useSharedValue(0);

  useEffect(() => {
    presencia.value = reducido ? 1 : withDelay(retraso, withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
  }, [reducido, retraso, presencia]);

  const estilo = useAnimatedStyle(() => ({ opacity: presencia.value }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.sello, { left: recta.x, top: recta.y, width: recta.width, height: recta.height }, estilo]}
    >
      <BordePunteado ancho={recta.width} alto={recta.height} tono={color.textFaint} />
      <View style={styles.centro}>
        <Icon name="check" size="md" color={color.textFaint} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sello: { position: 'absolute' },
  centro: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
