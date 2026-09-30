import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { color, motionDuration, motionEasing, radius } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { BordePunteado } from '@/shared/ui/fx/BordePunteado';

/** Cuánto se inclina el candado al abrirse (grados) y cuánto sube. */
const GIRO = -25;
const SUBE = 4;

interface Props {
  lado: number;
}

/**
 * El momento en que un anuncio abre un nivel: el borde punteado se vuelve sólido y se
 * apaga, y el candado se abre (se inclina, sube y se desvanece) sobre la celda que ya
 * pasó a abierta. Dura `lento`. Solo decoración: con reducir movimiento la celda
 * simplemente cambia (quien la usa no monta esto).
 */
export function DesbloqueoCelda({ lado }: Props) {
  const reducido = useMovimientoReducido();
  const avance = useSharedValue(0);

  useEffect(() => {
    if (!reducido) avance.value = withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar });
  }, [reducido, avance]);

  // El punteado desaparece en el primer tercio; el sólido entra, se sostiene y se va.
  const punteado = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, avance.value * 3) }));
  const solido = useAnimatedStyle(() => ({
    opacity: interpolate(avance.value, [0, 0.35, 0.75, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));
  const candado = useAnimatedStyle(() => ({
    opacity: 1 - avance.value,
    transform: [{ rotate: `${GIRO * avance.value}deg` }, { translateY: -SUBE * avance.value }],
  }));

  // Con reducir movimiento la celda solo cambia de estado: no hay punteado que se apague ni candado.
  if (reducido) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, punteado]}>
        <BordePunteado ancho={lado} alto={lado} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.solido, solido]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.centro, candado]}>
        <Icon name="lock" size="lg" color={color.accent} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  solido: { borderRadius: radius.md, borderWidth: 1.5, borderColor: color.accent },
  centro: { alignItems: 'center', justifyContent: 'center' },
});
