import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, font, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** De qué tamaño entra la frase. */
const ESCALA_INICIO = 0.96;

interface Props {
  texto: string;
}

/**
 * La frase en inglés de la ronda. Entra con un fundido y una escala de 0.96 a 1 en `lento`; quien la
 * usa le pone `key` de la ronda para que la entrada se repita en cada una. Con «reducir movimiento»
 * aparece sin escala, solo con el fundido.
 */
export function FraseRonda({ texto }: Props) {
  const reducido = useMovimientoReducido();
  const entrada = useSharedValue(0);

  useEffect(() => {
    entrada.set(withTiming(1, { duration: reducido ? motionDuration.rapido : motionDuration.lento, easing: motionEasing.entrar }));
  }, [reducido, entrada]);

  const estilo = useAnimatedStyle(() => ({
    opacity: entrada.get(),
    transform: [{ scale: reducido ? 1 : ESCALA_INICIO + (1 - ESCALA_INICIO) * entrada.get() }],
  }));

  return <Animated.Text style={[styles.frase, estilo]}>{texto}</Animated.Text>;
}

const styles = StyleSheet.create({
  frase: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
    textAlign: 'center',
  },
});
