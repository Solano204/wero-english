import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { color, escalon, motionDuration, motionEasing, motionSpring, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const ANCHO = 14;
const ALTO = 8;
const HUECO = space.xs;
/** Lo que crece un segmento al pasarle la ola del cierre. */
const CRECE_ALTO = 0.75;
const CRECE_ANCHO = 0.15;

/** El centro del segmento `i` respecto de la esquina de la fila: a donde vuela la tarjeta de un par resuelto. */
export function centroSegmento(i: number): { x: number; y: number } {
  return { x: i * (ANCHO + HUECO) + ANCHO / 2, y: ALTO / 2 };
}

interface SegmentoProps {
  encendido: boolean;
  /** La ola del cierre está pasando por la fila. */
  ola: boolean;
  /** Retraso (ms) con el que la ola llega a este segmento. */
  retraso: number;
}

const Segmento = memo(function Segmento({ encendido, ola, retraso }: SegmentoProps) {
  const reducido = useMovimientoReducido();
  const luz = useSharedValue(encendido ? 1 : 0);
  const pulso = useSharedValue(0);

  useEffect(() => {
    const meta = encendido ? 1 : 0;
    luz.value = reducido ? meta : withSpring(meta, motionSpring.rebote);
  }, [encendido, reducido, luz]);

  // Al cerrar el tablero cada segmento crece y vuelve, uno tras otro (`escalon`).
  useEffect(() => {
    if (!ola || reducido) return;
    pulso.value = withDelay(
      retraso,
      withSequence(
        withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
      )
    );
  }, [ola, reducido, retraso, pulso]);

  const relleno = useAnimatedStyle(() => ({
    opacity: Math.min(1, luz.value * 2),
    transform: [{ scaleX: Math.max(0, luz.value) }],
  }));
  const onda = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 + CRECE_ALTO * pulso.value }, { scaleX: 1 + CRECE_ANCHO * pulso.value }],
  }));

  return (
    <Animated.View style={[styles.segmento, onda]}>
      <Animated.View style={[styles.relleno, relleno]} />
    </Animated.View>
  );
});

interface Props {
  /** Cuántos pares tiene el tablero: un segmento por par. */
  total: number;
  /** Cuántos ya se juntaron. */
  resueltos: number;
  /** El tablero se cerró: una ola de luz recorre los segmentos, uno tras otro. */
  cierre?: boolean;
}

/**
 * El progreso de pares: un segmento por par, no un «0/5». Cada uno se enciende con un
 * resorte cuando la tarjeta de su par llega. El número real va en `accessibilityLabel`.
 */
export function SegmentosPares({ total, resueltos, cierre = false }: Props) {
  return (
    <View
      style={styles.fila}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${resueltos} de ${total} pares`}
      accessibilityValue={{ min: 0, max: total, now: resueltos }}
    >
      {Array.from({ length: total }, (_, i) => (
        <Segmento key={i} encendido={i < resueltos} ola={cierre} retraso={escalon(i)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: HUECO },
  segmento: { width: ANCHO, height: ALTO, borderRadius: radius.pill, backgroundColor: color.trackFondo, overflow: 'hidden' },
  relleno: { ...StyleSheet.absoluteFill, backgroundColor: color.accent, borderRadius: radius.pill, transformOrigin: 'left' },
});
