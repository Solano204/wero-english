import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming } from 'react-native-reanimated';
import { color, radius, space, motionCiclo, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const OPACIDAD_ALTA = 0.9;
const OPACIDAD_BAJA = 0.45;

interface BloqueProps {
  height?: number;
  width?: DimensionValue;
  /** Cubre a su contenedor (posición absoluta) en vez de tomar un alto propio. */
  relleno?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Bloque gris que late suave. Con Reduce Motion se queda quieto. */
export function Skeleton({ height = 16, width = '100%', relleno = false, style }: BloqueProps) {
  const reducido = useMovimientoReducido();
  const opacidad = useSharedValue(OPACIDAD_ALTA);

  useEffect(() => {
    if (reducido) {
      opacidad.value = OPACIDAD_BAJA;
      return;
    }
    opacidad.value = withRepeat(
      withSequence(
        withTiming(OPACIDAD_BAJA, { duration: motionCiclo.esqueleto, easing: motionEasing.ciclo }),
        withTiming(OPACIDAD_ALTA, { duration: motionCiclo.esqueleto, easing: motionEasing.ciclo })
      ),
      -1
    );
  }, [reducido, opacidad]);

  const animado = useAnimatedStyle(() => ({ opacity: opacidad.value }));

  return (
    <Animated.View
      style={[styles.bloque, relleno ? StyleSheet.absoluteFill : { height, width }, animado, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

interface ListaProps {
  filas?: number;
  alto?: number;
}

/** Esqueleto genérico de lista: N filas de tarjeta. */
export function SkeletonLista({ filas = 5, alto = 72 }: ListaProps) {
  return (
    <View style={styles.lista} accessibilityLabel="Cargando" accessibilityRole="progressbar">
      {Array.from({ length: filas }, (_, i) => (
        <Skeleton key={i} height={alto} style={styles.fila} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: {
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.sm,
  },
  lista: {
    gap: space.md,
  },
  fila: {
    borderRadius: radius.md,
  },
});
