import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { color, motionDuration, motionEasing, motionSpring, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const REPETICIONES = 3;
const LADO = 12;
/** La repetición en curso es un poco más grande y lleva un aro; al empezar late una vez. */
const LADO_ACTUAL = 16;
const PULSO = 1.4;

type Estado = 'hecha' | 'actual' | 'pendiente';

function Punto({ estado }: { estado: Estado }) {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(1);

  useEffect(() => {
    if (estado !== 'actual' || reducido) return;
    escala.value = withSequence(
      withTiming(PULSO, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withSpring(1, motionSpring.rebote)
    );
  }, [estado, reducido, escala]);

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
  return <Animated.View style={[styles.punto, estilos[estado], animado]} />;
}

interface Props {
  /** La repetición en curso, de 1 a 3. */
  ronda: 1 | 2 | 3;
  /** Lo que lee el lector de pantalla cuando no son repeticiones de una frase (las tres preguntas de una lectura). */
  etiqueta?: string;
}

/**
 * Las tres repeticiones de una frase: la hecha llena, la actual más grande con su aro y un latido al empezar, y la
 * pendiente hueca (se distinguen por forma, no solo por color). Para el lector de pantalla es una sola cosa:
 * «Repetición 2 de 3».
 */
export function PuntosRepeticion({ ronda, etiqueta }: Props) {
  return (
    <View
      style={styles.fila}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta ?? `Repetición ${ronda} de ${REPETICIONES}`}
      accessibilityValue={{ min: 1, max: REPETICIONES, now: ronda }}
    >
      {Array.from({ length: REPETICIONES }, (_, i) => {
        const estado: Estado = i + 1 < ronda ? 'hecha' : i + 1 === ronda ? 'actual' : 'pendiente';
        return <Punto key={i} estado={estado} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, minHeight: LADO_ACTUAL },
  punto: { width: LADO, height: LADO, borderRadius: LADO / 2 },
});

const estilos = StyleSheet.create({
  hecha: { backgroundColor: color.accent },
  actual: {
    width: LADO_ACTUAL,
    height: LADO_ACTUAL,
    borderRadius: LADO_ACTUAL / 2,
    backgroundColor: color.accent,
    borderWidth: 3,
    borderColor: color.accentBorde,
  },
  pendiente: { borderWidth: 1.5, borderColor: color.textFaint },
});
