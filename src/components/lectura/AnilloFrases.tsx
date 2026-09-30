import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { cancelAnimation, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { color, font, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

/** Grosor del anillo, en dp. */
const GROSOR = 4;

interface Props {
  /** Las frases de la historia que el usuario ya domina. */
  dominadas: number;
  total: number;
  /** Lado del anillo, en dp. */
  lado: number;
  /** Espera antes de llenarse (ms), para acompañar la entrada escalonada de la lista. */
  retraso?: number;
}

/**
 * El anillo de una historia: se llena con las frases que el usuario ya domina y lleva ese número al centro. Es un dibujo
 * (el texto de al lado dice «Te sabes 3 de 9 frases»), así que el lector de pantalla no lo lee. Se llena una vez al
 * entrar, en `escena`; con «reducir movimiento» ya está lleno. Es SVG y no Skia porque una lista lleva muchos.
 */
export function AnilloFrases({ dominadas, total, lado, retraso = 0 }: Props) {
  const reducido = useMovimientoReducido();
  const fraccion = total > 0 ? Math.min(1, dominadas / total) : 0;
  const llenado = useSharedValue(reducido ? fraccion : 0);

  useEffect(() => {
    if (reducido) {
      llenado.value = fraccion;
      return;
    }
    llenado.value = withDelay(retraso, withTiming(fraccion, { duration: motionDuration.escena, easing: motionEasing.entrar }));
    return () => cancelAnimation(llenado);
  }, [fraccion, reducido, retraso, llenado]);

  const centro = lado / 2;
  const radio = (lado - GROSOR) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const propsArco = useAnimatedProps(() => ({
    strokeDashoffset: circunferencia * (1 - llenado.value),
    // Con el anillo vacío la punta redondeada dibujaría un punto: no se dibuja nada.
    opacity: llenado.value > 0.001 ? 1 : 0,
  }));

  return (
    <View
      style={{ width: lado, height: lado }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={lado} height={lado}>
        <Circle cx={centro} cy={centro} r={radio} stroke={color.borderStrong} strokeWidth={GROSOR} fill="none" />
        <CirculoAnimado
          cx={centro}
          cy={centro}
          r={radio}
          stroke={color.accent}
          strokeWidth={GROSOR}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          fill="none"
          rotation={-90}
          origin={`${centro},${centro}`}
          animatedProps={propsArco}
        />
      </Svg>
      <View style={styles.centro}>
        <Text style={styles.numero}>{dominadas}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.text },
});
