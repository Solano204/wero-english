import React, { useEffect, useEffectEvent } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, font, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** La frase de la meta: fuente `md`; el título de la hoja: `xxl` de display. */
const TAMANO_META = font.size.md;
const TAMANO_TITULO = font.size.xxl;

/** Un rectángulo en el espacio de la capa de la pantalla. */
export interface RectaCapa {
  x: number;
  y: number;
  ancho: number;
}

interface Props {
  texto: string;
  /** Donde está la frase en la meta. */
  desde: RectaCapa;
  /** Donde va: el título de la hoja de la pregunta. */
  hasta: RectaCapa;
  /** Llegó: el título de la hoja ya puede aparecer. */
  onFin: () => void;
}

/**
 * La frase de la meta que se llenó, que se despega de su lugar y vuela hasta el título de la pregunta
 * (`lento`, `entrar`): crece de la letra de la meta a la del título mientras cruza, y se apaga al llegar para
 * dejar su lugar al título de verdad. Es un adorno: la hoja funciona igual sin ella. Va en el hilo de UI. Con «reducir
 * movimiento» no vuela: avisa que llegó y no dibuja nada.
 */
export function FraseVoladora({ texto, desde, hasta, onFin }: Props) {
  const reducido = useMovimientoReducido();
  const avance = useSharedValue(0);

  const alMontar = useEffectEvent(() => {
    if (reducido) {
      onFin();
      return;
    }
    avance.set(withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar }, (terminada) => {
      'worklet';
      if (terminada) runOnJS(onFin)();
    }));
    // El vuelo se lanza una sola vez por montaje.
  });
  useEffect(() => alMontar(), []);

  const escalaFinal = TAMANO_TITULO / TAMANO_META;
  const estilo = useAnimatedStyle(() => {
    const p = avance.get();
    return {
      opacity: 1 - Math.max(0, (p - 0.8) / 0.2),
      transform: [
        { translateX: (hasta.x - desde.x) * p },
        { translateY: (hasta.y - desde.y) * p },
        { scale: 1 + (escalaFinal - 1) * p },
      ],
    };
  });

  if (reducido) return null;
  return (
    <Animated.Text
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.frase, { left: desde.x, top: desde.y, width: desde.ancho }, estilo]}
    >
      {texto}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  frase: {
    position: 'absolute',
    zIndex: 20,
    transformOrigin: 'left top',
    fontFamily: font.family.body,
    fontSize: TAMANO_META,
    color: color.text,
  },
});
