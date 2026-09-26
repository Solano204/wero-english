import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Rect } from '@/components/fx';
import { color, font, motionDuration, motionEasing, text } from '@/theme';
import { useMovimientoReducido } from '@/utils';

/** El verbo del renglón de la lista (`h2`) y el del título de la página (`display`), en dp. */
const VERBO_FILA = font.size.xl;
const VERBO_TITULO = font.size.display;
const ESCALA_INICIAL = VERBO_FILA / VERBO_TITULO;
const CAJA_ANCHO = 240;
const CAJA_ALTO = 56;

/** El verbo que viaja: sale de su renglón de la lista y va a su lugar en la página, medidos ambos en la ventana. */
export interface Viaje {
  verbo: string;
  desde: Rect;
  /** Donde quedó el verbo de la página; null mientras la página todavía lo está midiendo. */
  hasta: Rect | null;
}

interface Props {
  viaje: Viaje;
  onFin: () => void;
}

/**
 * El verbo viaja del renglón de la lista a su título y crece de `h2` a `display`, en `escena` con la curva de lo que
 * entra. Solo `transform` y `opacity`. Espera a que la página diga dónde está su título; mientras tanto no se ve. Las
 * medidas son de la ventana: se restan del lugar de esta capa para no depender de la barra de estado. Con «reducir
 * movimiento» no hay viaje: termina de inmediato y el título ya está en su lugar.
 */
export function ViajeVerbo({ viaje, onFin }: Props) {
  const reducido = useMovimientoReducido();
  const p = useSharedValue(0);
  const raiz = useRef<View>(null);
  const [origen, setOrigen] = useState<{ x: number; y: number } | null>(null);
  const { desde, hasta } = viaje;

  useEffect(() => {
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
        <Text style={styles.verbo}>{viaje.verbo}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // La caja se centra en el origen de la capa: así trasladarla al centro del verbo la deja justo encima.
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
  verbo: { ...text.display, color: color.text },
});
