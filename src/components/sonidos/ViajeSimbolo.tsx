import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Rect } from '@/components/fx';
import { color, font, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { SIMBOLO_CHIP } from './IndiceFonemas';

/** El símbolo grande de la página, en dp. */
export const SIMBOLO_GRANDE = 64;
const CAJA_ANCHO = 240;
const CAJA_ALTO = 96;
const ESCALA_INICIAL = SIMBOLO_CHIP / SIMBOLO_GRANDE;

/** El símbolo que viaja: sale de su chip del índice y va a la página, medidos ambos en la ventana. */
export interface Viaje {
  /** El símbolo sin barras. */
  ipa: string;
  desde: Rect;
  /** Donde quedó el símbolo grande de la página; null mientras la página todavía lo está midiendo. */
  hasta: Rect | null;
}

interface Props {
  viaje: Viaje;
  onFin: () => void;
}

/**
 * El chip que viaja y crece hasta el símbolo grande de la página, en `escena` con la curva de lo que entra. Solo
 * `transform` y `opacity`. Espera a que la página diga dónde está su símbolo; mientras tanto no se ve. Las
 * medidas son de la ventana: se restan del lugar de esta capa para no depender de la barra de estado.
 */
export function ViajeSimbolo({ viaje, onFin }: Props) {
  const reducido = useMovimientoReducido();
  const p = useSharedValue(0);
  const raiz = useRef<View>(null);
  const [origen, setOrigen] = useState<{ x: number; y: number } | null>(null);
  const { desde, hasta } = viaje;

  useEffect(() => {
    // Con «reducir movimiento» no hay viaje: el símbolo de la página aparece ya en su lugar.
    if (reducido) {
      onFin();
      return;
    }
    if (!hasta || !origen) return;
    p.value = withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar }, (fin) => {
      if (fin) runOnJS(onFin)();
    });
  }, [reducido, hasta, origen, p, onFin]);

  const listo = hasta !== null && origen !== null;
  const ox = origen?.x ?? 0;
  const oy = origen?.y ?? 0;
  const estilo = useAnimatedStyle(() => {
    if (!hasta) return { opacity: 0 };
    const x0 = desde.x + desde.width / 2 - ox;
    const y0 = desde.y + desde.height / 2 - oy;
    const x1 = hasta.x + hasta.width / 2 - ox;
    const y1 = hasta.y + hasta.height / 2 - oy;
    return {
      opacity: 1,
      transform: [
        { translateX: x0 + (x1 - x0) * p.value },
        { translateY: y0 + (y1 - y0) * p.value },
        { scale: ESCALA_INICIAL + (1 - ESCALA_INICIAL) * p.value },
      ],
    };
  });

  return (
    <View
      ref={raiz}
      collapsable={false}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={() => raiz.current?.measureInWindow((x, y) => setOrigen({ x, y }))}
    >
      <Animated.View style={[styles.caja, listo ? null : styles.oculta, estilo]}>
        <Text style={styles.simbolo}>{viaje.ipa}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // La caja se centra en el origen de la capa: así trasladarla al centro del símbolo la deja justo encima.
  caja: {
    position: 'absolute',
    left: -CAJA_ANCHO / 2,
    top: -CAJA_ALTO / 2,
    width: CAJA_ANCHO,
    height: CAJA_ALTO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oculta: { opacity: 0 },
  simbolo: {
    fontFamily: font.family.ipa,
    fontSize: SIMBOLO_GRANDE,
    letterSpacing: SIMBOLO_GRANDE * -0.015,
    color: color.accent,
  },
});
