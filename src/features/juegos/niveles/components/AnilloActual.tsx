import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useReloj, useSenalActiva } from '@/shared/ui/fx/useSenalActiva';
import { color, motionSenal, radius } from '@/theme';

/** A qué tamaño (respecto de la celda) se queda el anillo fijo alrededor del nivel actual. */
const ESCALA_ANILLO = 1.2;
/** Hasta dónde crece la onda antes de apagarse. */
const ESCALA_ONDA = 1.6;
const GROSOR = 2;
/** La onda nace a esta opacidad y se apaga al crecer. */
const OPACIDAD_ONDA = 0.6;

interface Props {
  /** Lado de la celda (dp). */
  lado: number;
}

/**
 * El anillo de señal del nivel actual: uno fijo alrededor de la celda y, encima, una onda
 * (el mismo contorno, que crece y se desvanece) cada 2.4 s. Es el único bucle de la
 * pantalla: se pausa sin foco o en segundo plano (MOT-4) y con reducir movimiento la
 * onda no existe y queda el anillo fijo (MOT-5). Decorativo: el lector de pantalla no lo ve.
 */
export function AnilloActual({ lado }: Props) {
  const { activo, reducido } = useSenalActiva();
  const fase = useReloj(motionSenal.ondaNivel, { activo, reducido, faseQuieta: 0 });

  const onda = useAnimatedStyle(() => ({
    opacity: reducido ? 0 : OPACIDAD_ONDA * (1 - fase.get()),
    transform: [{ scale: ESCALA_ANILLO + (ESCALA_ONDA - ESCALA_ANILLO) * fase.get() }],
  }));

  return (
    <View pointerEvents="none" style={[styles.capa, { width: lado, height: lado }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.contorno, { width: lado, height: lado }, onda]} />
      <View style={[styles.contorno, styles.fijo, { width: lado, height: lado }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  capa: { position: 'absolute', left: 0, top: 0 },
  contorno: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radius.md,
    borderWidth: GROSOR,
    borderColor: color.accent,
  },
  fijo: { transform: [{ scale: ESCALA_ANILLO }] },
});
