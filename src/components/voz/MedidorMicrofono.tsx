import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Icon } from '@/components/base/Icon';
import { color, radius } from '@/theme';
import { useMovimientoReducido } from '@/utils';

/** Diámetro del círculo en reposo. */
const DIAMETRO = 72;
/** Cuánto crece con la voz más fuerte. */
const CRECE = 0.6;

interface Props {
  /** 0 a 1: el volumen de la voz (useEscucha). */
  nivel: SharedValue<number>;
  /** Escuchando: el círculo sigue la voz. Si no, queda en reposo y apagado. */
  activo: boolean;
}

/**
 * Un círculo que crece con tu voz mientras el micrófono escucha: así se ve que el teléfono sí te está oyendo (y si
 * no se mueve, que no). Con «reducir movimiento» no crece: cambia la opacidad.
 */
export function MedidorMicrofono({ nivel, activo }: Props) {
  const reducido = useMovimientoReducido();
  const onda = useAnimatedStyle(() =>
    reducido
      ? { opacity: activo ? 0.35 + nivel.value * 0.65 : 0 }
      : { opacity: activo ? 1 : 0, transform: [{ scale: 1 + nivel.value * CRECE }] }
  );
  return (
    <View style={styles.caja} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[styles.onda, onda]} />
      <View style={[styles.centro, activo && styles.centroActivo]}>
        <Icon name="microphone" size="lg" color={activo ? color.onPrimario : color.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { width: DIAMETRO * (1 + CRECE), height: DIAMETRO * (1 + CRECE), alignItems: 'center', justifyContent: 'center' },
  onda: { position: 'absolute', width: DIAMETRO, height: DIAMETRO, borderRadius: radius.pill, backgroundColor: color.accentSoft },
  centro: {
    width: DIAMETRO * 0.75,
    height: DIAMETRO * 0.75,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceAlt,
  },
  centroActivo: { backgroundColor: color.primario },
});
