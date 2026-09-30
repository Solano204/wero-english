import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming } from 'react-native-reanimated';
import { color, motionEasing, motionEfecto } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

const PIECES = 18;
const TINTS = [
  color.accent,
  color.correct,
  color.world.dia_a_dia,
  color.world.gente,
  color.riskWarn,
];

interface Props {
  active: boolean;
}

/**
 * Celebración al terminar la sesión.
 *
 * Dieciocho piezas, no cien: en un teléfono de gama baja cada pieza es
 * una vista animada, y la pantalla de resultado no puede tartamudear
 * justo en el momento que se supone que se siente bien.
 */
export function Confetti({ active }: Props) {
  const { width } = useWindowDimensions();
  const reducido = useMovimientoReducido();
  if (!active || reducido) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: PIECES }).map((_, i) => (
        <Piece key={i} index={i} width={width} />
      ))}
    </View>
  );
}

function Piece({ index, width }: { index: number; width: number }) {
  const fall = useSharedValue(0);
  const startX = (index / PIECES) * width + (Math.random() * 30 - 15);
  const drift = Math.random() * 70 - 35;
  const spin = Math.random() * 540 - 270;
  const tint = TINTS[index % TINTS.length] ?? color.accent;
  const delay = index * motionEfecto.confetiEscalon;

  useEffect(() => {
    fall.value = withDelay(
      delay,
      withTiming(1, { duration: motionEfecto.confeti, easing: motionEasing.entrar })
    );
  }, [fall, delay]);

  const anim = useAnimatedStyle(() => ({
    opacity: 1 - fall.value * 0.9,
    transform: [
      { translateY: -40 + fall.value * 420 },
      { translateX: fall.value * drift },
      { rotate: `${fall.value * spin}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { left: startX, backgroundColor: tint },
        anim,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 12,
    borderRadius: 2,
  },
});
