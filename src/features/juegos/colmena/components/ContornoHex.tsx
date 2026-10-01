import React, { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { color, motionColmena, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { puntosHexagono } from '@/features/juegos/colmena/logic/geometria';

/** Con la ronda resuelta los contornos del panal se quedan a esta opacidad, detrás de la frase. */
const OPACIDAD_TENUE = 0.35;

interface ContornoProps {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** La ronda se resolvió: el contorno se atenúa y queda de fondo de la frase. */
  atenuado: boolean;
  /** Se pasa a la ronda siguiente: el contorno sale hacia abajo. */
  saliendo: boolean;
  /** Cuánto espera para salir (el escalón de su distancia al centro). */
  retrasoSalida: number;
}

/**
 * El lugar del hexágono cuando su ficha se fue: un contorno fino que no se toca. Al resolverse la ronda se
 * atenúa y queda de fondo; al pasar a la siguiente, sale hacia abajo y se desvanece: es el panal que se deshace.
 * Con «reducir movimiento» solo cambia la opacidad.
 */
export const ContornoHex = memo(function ContornoHex({ x, y, ancho, alto, atenuado, saliendo, retrasoSalida }: ContornoProps) {
  const reducido = useMovimientoReducido();
  const tenue = useSharedValue(0);
  const salida = useSharedValue(0);

  useEffect(() => {
    tenue.set(withTiming(atenuado ? 1 : 0, {
      duration: reducido ? motionDuration.rapido : motionDuration.base,
      easing: motionEasing.entrar,
    }));
  }, [atenuado, reducido, tenue]);

  useEffect(() => {
    if (!saliendo) return;
    const ir = withTiming(1, {
      duration: reducido ? motionDuration.rapido : motionColmena.salida / 2,
      easing: motionEasing.salir,
    });
    salida.set(reducido || retrasoSalida <= 0 ? ir : withDelay(retrasoSalida, ir));
  }, [saliendo, reducido, retrasoSalida, salida]);

  const estilo = useAnimatedStyle(() => ({
    opacity: (1 - (1 - OPACIDAD_TENUE) * tenue.get()) * (1 - salida.get()),
    transform: [{ translateY: reducido ? 0 : salida.get() * motionColmena.caeDp * 1.5 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.abs, { left: x, top: y, width: ancho, height: alto }, estilo]}
    >
      <Svg width={ancho} height={alto}>
        <Polygon points={puntosHexagono(ancho, alto, 0.5)} fill="none" stroke={color.border} strokeWidth={1} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
});
