import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button } from '@/components/base/Button';
import { Icon } from '@/components/base/Icon';
import { color, motionDuration, motionEasing, motionSpring } from '@/theme';
import { useMovimientoReducido } from '@/utils';

/** Lado del ícono (el `lg` de `Icon`): el anillo nace de ese tamaño. */
const LADO = 24;
/** Cuánto crece la estrella al guardar. */
const ESCALA_ESTRELLA = 1.25;
/** Hasta cuánto se expande el anillo dorado (veces el ícono). */
const EXPANSION_ANILLO = 2.4;

interface Props {
  guardada: boolean;
  /** Sube en 1 cada vez que la frase pasa a guardada: dispara la fiesta. Quitarla no la dispara. */
  pulso: number;
  onPress: () => void;
}

/**
 * La acción principal de Detalle, fija en la zona del pulgar. «Guardar» es el botón
 * `primary` con una estrella; ya guardada pasa a «Guardada» en `secondary` con la
 * estrella rellena en `star`. Al guardar la estrella hace 1 → 1.25 → 1 con resorte y
 * un anillo dorado se expande una sola vez desde el ícono; al quitarla solo cambia el
 * estado, sin fiesta. Con reducir movimiento no hay estrella que salte ni anillo.
 */
export function BotonGuardar({ guardada, pulso, onPress }: Props) {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(1);
  // 1 = el anillo ya terminó (invisible): en reposo no se ve nada.
  const anillo = useSharedValue(1);

  useEffect(() => {
    if (pulso === 0 || reducido) return;
    escala.value = withSequence(withSpring(ESCALA_ESTRELLA, motionSpring.rebote), withSpring(1, motionSpring.rebote));
    anillo.value = 0;
    anillo.value = withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar });
  }, [pulso, reducido, escala, anillo]);

  const estrella = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - anillo.value),
    transform: [{ scale: 1 + (EXPANSION_ANILLO - 1) * anillo.value }],
  }));

  const icono = (
    <View style={styles.icono}>
      <Animated.View style={[styles.anillo, halo]} pointerEvents="none" />
      <Animated.View style={estrella}>
        <Icon name={guardada ? 'star-filled' : 'star'} size="lg" color={guardada ? color.star : color.onAccent} />
      </Animated.View>
    </View>
  );

  return (
    <Button
      label={guardada ? 'Guardada' : 'Guardar'}
      accessibilityLabel={guardada ? 'Guardada en Mi mazo. Toca para quitarla' : 'Guardar en Mi mazo'}
      variant={guardada ? 'secondary' : 'primary'}
      size="lg"
      full
      iconNode={icono}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  icono: { width: LADO, height: LADO, alignItems: 'center', justifyContent: 'center' },
  anillo: {
    position: 'absolute',
    width: LADO,
    height: LADO,
    borderRadius: LADO / 2,
    borderWidth: 2,
    borderColor: color.star,
  },
});
