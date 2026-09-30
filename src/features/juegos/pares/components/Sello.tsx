import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { BordePunteado } from '@/shared/ui/fx/BordePunteado';
import { Icon } from '@/shared/ui/Icon';
import { color, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Rect } from '@/features/juegos/pares/logic/geometria';

interface Props {
  recta: Rect;
  /** El tablero se cerró: el sello se desvanece. */
  saliendo?: boolean;
  /** Retraso (ms) del desvanecimiento: los sellos se van escalonados, en el orden de lectura. */
  retraso?: number;
}

/**
 * Lo que queda donde estuvo una ficha cuyo par ya se juntó: un borde punteado y una
 * palomita en `textFaint`. Es un hueco «cumplido», no una ficha apagada: el tablero no se
 * mueve y se lee de un vistazo cuánto falta. Al cerrar el tablero se desvanece uno tras
 * otro; con «reducir movimiento» ni aparece ni se va con animación. Decorativo: el
 * progreso lo dice el `progressbar` de arriba.
 */
export function Sello({ recta, saliendo = false, retraso = 0 }: Props) {
  const reducido = useMovimientoReducido();
  const presencia = useSharedValue(reducido ? 1 : 0);

  useEffect(() => {
    if (reducido) {
      presencia.value = 1;
      return;
    }
    const cfg = { duration: motionDuration.base, easing: motionEasing.entrar };
    presencia.value = saliendo ? withDelay(retraso, withTiming(0, cfg)) : withTiming(1, cfg);
  }, [saliendo, reducido, retraso, presencia]);

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
