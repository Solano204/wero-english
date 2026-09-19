import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color, font } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const N = 9;
const TINTS = [color.accent, color.correct, color.world.fonetica, color.world.gente];

interface Props {
  /** Cambia este número en cada acierto para relanzar el estallido. */
  disparo: number;
}

/**
 * Estrellas al acertar.
 *
 * Nueve, no treinta: en un teléfono de gama baja cada estrella es una
 * vista animada, y el estallido tiene que salir en el mismo instante del
 * acierto o deja de sentirse como consecuencia de lo que hiciste.
 *
 * Dura 700 ms y no bloquea el toque. La celebración nunca puede
 * retrasar la siguiente jugada: si tienes que esperar a que termine la
 * fiesta, la fiesta estorba.
 */
export function Estrellas({ disparo }: Props) {
  const reducido = useMovimientoReducido();
  if (disparo === 0 || reducido) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: N }).map((_, i) => (
        <Chispa key={`${disparo}-${i}`} i={i} />
      ))}
    </View>
  );
}

function Chispa({ i }: { i: number }) {
  const p = useSharedValue(0);

  // Se reparten en abanico desde el centro. El ángulo es fijo por índice
  // para que el estallido se vea equilibrado y no agrupado por azar.
  const angulo = (Math.PI * 2 * i) / N - Math.PI / 2;
  const dist = 90 + (i % 3) * 34;

  useEffect(() => {
    p.value = withDelay(
      i * 18,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [i, p]);

  const anim = useAnimatedStyle(() => ({
    opacity: p.value < 0.75 ? 1 : (1 - p.value) * 4,
    transform: [
      { translateX: Math.cos(angulo) * dist * p.value },
      { translateY: Math.sin(angulo) * dist * p.value },
      { scale: 0.4 + p.value * 0.8 },
      { rotate: `${p.value * 220}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.chispa, anim]}>
      <Text style={[styles.glifo, { color: TINTS[i % TINTS.length] }]}>★</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chispa: {
    position: 'absolute',
    left: '50%',
    top: '42%',
    marginLeft: -10,
    marginTop: -10,
  },
  glifo: { fontSize: 20, fontWeight: font.weight.bold },
});
