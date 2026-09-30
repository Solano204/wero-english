import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';

const LADO = 10;

const Ficha = memo(function Ficha({ queda }: { queda: boolean }) {
  const reducido = useMovimientoReducido();
  const presencia = useSharedValue(queda ? 1 : 0);

  useEffect(() => {
    const meta = queda ? 1 : 0;
    presencia.value = reducido ? meta : withTiming(meta, { duration: motionDuration.base, easing: motionEasing.salir });
  }, [queda, reducido, presencia]);

  const anim = useAnimatedStyle(() => ({ opacity: presencia.value, transform: [{ scale: 0.4 + 0.6 * presencia.value }] }));
  return <Animated.View style={[styles.ficha, anim]} />;
});

interface Props {
  /** Las jugadas con las que empezó el tablero. */
  total: number;
  /** Las que quedan: una fichita por cada una. */
  restantes: number;
}

/**
 * Las jugadas que quedan como una fila de fichitas: una por jugada, y al gastarse se
 * encoge y se va. Es solo una imagen del número: el texto «Te quedan N jugadas» va al
 * lado y el lector de pantalla no lee las fichitas. Sin color de alarma: quedarse sin
 * jugadas no acaba la partida.
 */
export function FichasJugadas({ total, restantes }: Props) {
  return (
    <View style={styles.fila} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => (
        <Ficha key={i} queda={i < restantes} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1, flexWrap: 'wrap' },
  ficha: { width: LADO, height: LADO, borderRadius: 3, backgroundColor: color.textMuted },
});
