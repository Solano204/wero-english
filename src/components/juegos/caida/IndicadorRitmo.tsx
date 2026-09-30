import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from '@/components/base/Icon';
import { color, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import { CHEVRONS } from './medidas';

const Chevron = memo(function Chevron({ encendido }: { encendido: boolean }) {
  const reducido = useMovimientoReducido();
  const luz = useSharedValue(encendido ? 1 : 0);

  useEffect(() => {
    const meta = encendido ? 1 : 0;
    luz.value = reducido ? meta : withTiming(meta, { duration: motionDuration.base, easing: motionEasing.entrar });
  }, [encendido, reducido, luz]);

  const encendida = useAnimatedStyle(() => ({ opacity: luz.value }));

  return (
    <View style={styles.chevron}>
      <Icon name="chevron-down" size="sm" color={color.textFaint} />
      <Animated.View style={[StyleSheet.absoluteFill, encendida]}>
        <Icon name="chevron-down" size="sm" color={color.accent} />
      </Animated.View>
    </View>
  );
});

interface Props {
  /** Cuántos chevrons están encendidos, de 1 a `CHEVRONS`: qué tan rápido va la ronda. */
  nivel: number;
}

/**
 * Qué tan rápido va la ronda: una fila de chevrons hacia abajo que se encienden en `accent` conforme la
 * caída se acelera (`chevronsPara`). Es información, no una alarma: nunca ámbar ni rojo. Para el lector de
 * pantalla es una sola frase, «Ritmo 3 de 5».
 */
export function IndicadorRitmo({ nivel }: Props) {
  return (
    <View
      style={styles.fila}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Ritmo ${nivel} de ${CHEVRONS}`}
    >
      {Array.from({ length: CHEVRONS }, (_, i) => (
        <Chevron key={i} encendido={i < nivel} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
  chevron: { width: 16, height: 16 },
});
