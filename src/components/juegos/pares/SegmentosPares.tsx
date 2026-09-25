import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { color, escalon, motionSpring, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const ANCHO = 14;
const ALTO = 8;
const HUECO = space.xs;

/** El centro del segmento `i` respecto de la esquina de la fila: a donde vuela la tarjeta de un par resuelto. */
export function centroSegmento(i: number): { x: number; y: number } {
  return { x: i * (ANCHO + HUECO) + ANCHO / 2, y: ALTO / 2 };
}

interface SegmentoProps {
  encendido: boolean;
  /** Retraso (ms) de este segmento: la cascada del cierre del tablero. */
  retraso: number;
}

const Segmento = memo(function Segmento({ encendido, retraso }: SegmentoProps) {
  const reducido = useMovimientoReducido();
  const luz = useSharedValue(encendido ? 1 : 0);

  useEffect(() => {
    const meta = encendido ? 1 : 0;
    luz.value = reducido ? meta : withDelay(retraso, withSpring(meta, motionSpring.rebote));
  }, [encendido, retraso, reducido, luz]);

  const relleno = useAnimatedStyle(() => ({
    opacity: Math.min(1, luz.value * 2),
    transform: [{ scaleX: Math.max(0, luz.value) }],
  }));

  return (
    <View style={styles.segmento}>
      <Animated.View style={[styles.relleno, relleno]} />
    </View>
  );
});

interface Props {
  /** Cuántos pares tiene el tablero: un segmento por par. */
  total: number;
  /** Cuántos ya se juntaron. */
  resueltos: number;
  /** Se encienden todos en cascada (`escalon(i)`), en vez de uno a uno. Al cerrar el tablero. */
  cascada?: boolean;
}

/**
 * El progreso de pares: un segmento por par, no un «0/5». Cada uno se enciende con un
 * resorte cuando su par se junta. El número real va en `accessibilityLabel`.
 */
export function SegmentosPares({ total, resueltos, cascada = false }: Props) {
  return (
    <View
      style={styles.fila}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${resueltos} de ${total} pares`}
      accessibilityValue={{ min: 0, max: total, now: resueltos }}
    >
      {Array.from({ length: total }, (_, i) => (
        <Segmento key={i} encendido={i < resueltos} retraso={cascada ? escalon(i) : 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: HUECO },
  segmento: { width: ANCHO, height: ALTO, borderRadius: radius.pill, backgroundColor: color.trackFondo, overflow: 'hidden' },
  relleno: { ...StyleSheet.absoluteFill, backgroundColor: color.accent, borderRadius: radius.pill, transformOrigin: 'left' },
});
