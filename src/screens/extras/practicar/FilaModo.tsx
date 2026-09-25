import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Icon, Presionable } from '@/components/base';
import { color, escalon, font, layout, motionDuration, space } from '@/theme';

interface Props {
  titulo: string;
  dato?: string | null;
  primera: boolean;
  onPress: () => void;
  /** Posición en el grupo y avance de su despliegue: la fila entra con `escalon(indice)`. */
  indice?: number;
  progreso?: SharedValue<number>;
}

/** Renglón compacto de un grupo: nombre, dato opcional y chevron. 48 dp como mínimo. */
export function FilaModo({ titulo, dato, primera, onPress, indice = 0, progreso }: Props) {
  const retraso = escalon(indice);
  const entrada = useAnimatedStyle(() => {
    const avance = progreso ? progreso.value : 1;
    const t = interpolate(avance * motionDuration.lento, [retraso, motionDuration.lento], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: (1 - t) * space.sm }] };
  });
  return (
    <Animated.View style={entrada}>
    <Presionable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.fila, !primera && styles.separada]}
    >
      <Text style={styles.nombre} numberOfLines={2}>
        {titulo}
      </Text>
      {dato ? (
        <Text style={styles.dato} numberOfLines={1}>
          {dato}
        </Text>
      ) : null}
      <Icon name="chevron-right" size="md" color={color.textFaint} />
    </Presionable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fila: {
    minHeight: layout.tapMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  separada: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  nombre: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.md,
    color: color.text,
  },
  dato: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textFaint },
});
