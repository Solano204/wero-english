import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Rect } from '@/components/fx';
import { color, font, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';

/** Cuánto crece al llegar: de la letra de una opción (16) a la de la frase (28). */
const CRECE = font.size.xxl / font.size.md - 1;
/** Desde este avance empieza a desvanecerse para que el hueco tome la palabra sin doble imagen. */
const DESDE_DESVANECE = 0.8;

interface Props {
  palabra: string;
  /** Dónde está la opción tocada y dónde el hueco, en la ventana. */
  de: Rect;
  a: Rect;
  /** Dónde queda esta capa en la ventana, para pasar de coordenadas de ventana a las suyas. */
  desfase: { x: number; y: number };
  alTerminar: () => void;
}

/**
 * La palabra que sale de su opción y se desliza hasta el hueco de la frase, creciendo
 * al tamaño de la frase. Va en una capa encima de todo, sin recibir toques. Es solo
 * decoración: el veredicto no depende de que llegue (si esto falla, el hueco se llena
 * igual al calificar).
 */
export function PalabraVoladora({ palabra, de, a, desfase, alTerminar }: Props) {
  const reducido = useMovimientoReducido();
  const avance = useSharedValue(0);
  const dx = a.x + a.width / 2 - (de.x + de.width / 2);
  const dy = a.y + a.height / 2 - (de.y + de.height / 2);

  useEffect(() => {
    // Con movimiento reducido no hay vuelo: el hueco se llena de una vez.
    if (reducido) {
      alTerminar();
      return;
    }
    avance.value = withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar }, (terminado) => {
      if (terminado) runOnJS(alTerminar)();
    });
    // Un vuelo por montaje: la capa se remonta con cada palabra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => {
    const t = avance.value;
    return {
      opacity: t < DESDE_DESVANECE ? 1 : (1 - t) / (1 - DESDE_DESVANECE),
      transform: [{ translateX: dx * t }, { translateY: dy * t }, { scale: 1 + CRECE * t }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.capa, { left: de.x - desfase.x, top: de.y - desfase.y, width: de.width, height: de.height }, anim]}
    >
      <Animated.Text style={styles.palabra}>{palabra}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  capa: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  palabra: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
});
