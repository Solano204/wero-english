import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { color, motionDuration, motionEasing, motionSpring, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { puntosHexagono } from '@/features/juegos/colmena/logic/geometria';

/** El hexágono más grande de la fila; con muchas rondas se encoge para que quepan todas. */
const LADO_MAX = 20;
const PROPORCION = 2 / Math.sqrt(3);
const FILO = 1.5;
/** Cuánto crece una celda al cambiar de estado antes de asentarse. */
const PULSO = 1.3;

type Estado = 'hecha' | 'actual' | 'pendiente';

interface CeldaProps {
  estado: Estado;
  ancho: number;
}

const Celda = memo(function Celda({ estado, ancho }: CeldaProps) {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(1);
  const previo = useRef(estado);
  const alto = Math.round(ancho * PROPORCION);

  // Al cambiar de estado (se hizo la ronda, o le toca) la celda late una vez.
  useEffect(() => {
    if (previo.current === estado) return;
    previo.current = estado;
    if (reducido || estado === 'pendiente') return;
    escala.set(withSequence(
      withTiming(PULSO, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withSpring(1, motionSpring.rebote)
    ));
  }, [estado, reducido, escala]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));

  // El grosor del trazo redondea las puntas: el relleno y el trazo van del mismo color salvo en la actual.
  const relleno = estado === 'hecha' ? color.accent : color.trackFondo;
  const trazo = estado === 'pendiente' ? color.trackFondo : color.accent;
  return (
    <Animated.View style={[{ width: ancho, height: alto }, estilo]}>
      <Svg width={ancho} height={alto}>
        <Polygon
          points={puntosHexagono(ancho, alto, FILO / 2)}
          fill={relleno}
          stroke={trazo}
          strokeWidth={FILO}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
});

interface Props {
  /** Cuántas rondas tiene la partida. */
  total: number;
  /** La ronda en curso (0-based). */
  actual: number;
  /** Esa ronda ya se resolvió: su hexágono se llena sin esperar a la siguiente. */
  resuelta: boolean;
}

/**
 * El progreso de las rondas: un hexágono por ronda. Las hechas van llenas en `accent`, la actual con filo de
 * `accent` sobre `trackFondo` y las que faltan en `trackFondo`. Para el lector de pantalla es una sola cosa:
 * «1 de 8». Con «reducir movimiento» las celdas cambian sin el latido.
 */
export function ProgresoHex({ total, actual, resuelta }: Props) {
  const { width } = useWindowDimensions();
  const disponible = width - space.lg * 2;
  const ancho = Math.max(8, Math.min(LADO_MAX, Math.floor((disponible - (total - 1) * space.xs) / Math.max(1, total))));
  return (
    <View
      style={styles.fila}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${actual + 1} de ${total}`}
      accessibilityValue={{ min: 1, max: total, now: actual + 1 }}
    >
      {Array.from({ length: total }, (_, i) => {
        const estado: Estado = i < actual || (i === actual && resuelta) ? 'hecha' : i === actual ? 'actual' : 'pendiente';
        return <Celda key={i} estado={estado} ancho={ancho} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.xs },
});
