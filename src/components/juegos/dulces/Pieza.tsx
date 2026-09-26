import React, { type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Presionable } from '@/components/base/Presionable';
import { color, radius } from '@/theme';
import { CaraPieza } from './SimboloPieza';
import { etiquetaPieza } from './piezas';

/** El área táctil mínima: una pieza más chica que esto se amplía con `hitSlop` hasta llegar. */
const AREA_MINIMA = 48;

type AnimacionesDeLugar = Pick<ComponentProps<typeof Animated.View>, 'entering' | 'exiting' | 'layout'>;

interface Props extends AnimacionesDeLugar {
  /** El color de la pieza: decide su tinte y su forma. */
  color: number;
  fila: number;
  col: number;
  lado: number;
  elegida: boolean;
  onPress: () => void;
}

/**
 * Una pieza del tablero: un cubito con su forma. Un `Animated.View` exterior lleva el lugar (`entering`,
 * `layout`) y adentro va el `Presionable`. Separadas porque `Presionable` anima `transform` con
 * `useAnimatedStyle` y una vista no puede tener a la vez eso y una animación de entrada o de reacomodo:
 * Reanimated avisa «Property "transform" of AnimatedComponent…» y una pisa a la otra.
 *
 * Lleva su forma además del color y una etiqueta que las dice («Pieza naranja, círculo, fila 2 columna
 * 3»). Si la pieza mide menos de 48 dp (8 columnas en un teléfono angosto) el área táctil se completa con
 * `hitSlop`.
 */
export const Pieza = React.memo(function Pieza({ color: c, fila, col, lado, elegida, onPress, entering, exiting, layout }: Props) {
  const holgura = Math.max(0, Math.ceil((AREA_MINIMA - lado) / 2));
  return (
    <Animated.View entering={entering} exiting={exiting} layout={layout} style={{ width: lado, height: lado }}>
      <Presionable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={etiquetaPieza(c, fila, col)}
        accessibilityState={{ selected: elegida }}
        hitSlop={holgura}
        style={styles.pieza}
      >
        <CaraPieza color={c} lado={lado} />
        {elegida ? <View pointerEvents="none" style={styles.anillo} /> : null}
      </Presionable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  pieza: { flex: 1, borderRadius: radius.sm },
  // El anillo de la pieza elegida va encima y no toca el tamaño de la pieza.
  anillo: { ...StyleSheet.absoluteFill, borderRadius: radius.sm, borderWidth: 3, borderColor: color.text },
});
