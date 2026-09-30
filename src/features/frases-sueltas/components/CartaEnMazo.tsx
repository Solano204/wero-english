import React, { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { bajaDeProfundidad, escalaDeProfundidad, opacidadDeProfundidad } from '@/domain/mazo';
import { color, motionDuration, motionEasing, motionMazo, radius } from '@/theme';
import type { Entry } from '@/types';
import { CartaFrase, type Modo, type Sonando } from './CartaFrase';

export interface CartaProps {
  n: number;
  entry: Entry;
  esActual: boolean;
  /** Su lugar en el mazo cuando este se armó (0, 1 o 2) si le toca el abanico de entrada; las que llegan después, null. */
  lugarInicial: number | null;
  alto: number;
  ancho: number;
  pos: SharedValue<number>;
  topIdx: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  rot: SharedValue<number>;
  reducido: boolean;
  sonando: Sonando | null;
  onSonar: (modo: Modo) => void;
  guardada: boolean;
  onSiguiente: () => void;
  onGuardar: () => void;
}

/**
 * Una carta del mazo. Su lugar sale de `n - pos` (cuántos lugares hay entre ella y la de arriba, con decimales mientras
 * el mazo avanza): las de atrás se asoman, más chicas y más tenues; la de arriba (`topIdx`) sigue al dedo con `tx`, `ty`
 * y `rot`. Como `pos` nunca vuelve atrás, la carta de atrás sube sin parpadeo mientras la de arriba se va. Toda carta
 * nueva aparece con un fundido. Al armarse el mazo, las dos de atrás se abren en abanico (una a la izquierda y otra a la
 * derecha, `abre` en `motionMazo`) y se juntan, con un escalón entre carta y carta; la de arriba se queda quieta.
 */
export const CartaEnMazo = memo(function CartaEnMazo({
  n,
  entry,
  esActual,
  lugarInicial,
  alto,
  ancho,
  pos,
  topIdx,
  tx,
  ty,
  rot,
  reducido,
  sonando,
  onSonar,
  guardada,
  onSiguiente,
  onGuardar,
}: CartaProps) {
  const llegada = useSharedValue(0);
  const abre = useSharedValue(0);
  // La segunda se abre a la izquierda y la tercera a la derecha; la de arriba no se mueve.
  const lado = lugarInicial === 1 ? -1 : lugarInicial === 2 ? 1 : 0;

  useEffect(() => {
    llegada.value = reducido ? 1 : withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
    return () => cancelAnimation(llegada);
  }, [reducido, llegada]);

  useEffect(() => {
    if (reducido || lugarInicial === null || lugarInicial === 0) return;
    abre.value = withDelay(
      motionMazo.escalon * lugarInicial,
      withSequence(
        withTiming(1, { duration: motionMazo.abre, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionMazo.junta, easing: motionEasing.ciclo })
      )
    );
    return () => cancelAnimation(abre);
    // Solo al armarse el mazo: `lugarInicial` no cambia mientras la carta está montada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Las de atrás van tapadas con el color de la carta (en iOS el fondo es translúcido y se les vería el texto); al subir se destapan.
  const velo = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, n - pos.value)) }));

  const estilo = useAnimatedStyle(() => {
    const d = n - pos.value;
    // La que ya salió no se ve, aunque su lugar en pantalla sea el último del lanzamiento.
    if (d <= -1) return { opacity: 0 };
    const arriba = topIdx.value === n;
    return {
      opacity: opacidadDeProfundidad(d) * llegada.value,
      transform: [
        { translateX: (arriba ? tx.value : 0) + lado * motionMazo.separa * abre.value },
        { translateY: (arriba ? ty.value : 0) + bajaDeProfundidad(d) },
        { rotate: `${(arriba ? rot.value : 0) + lado * motionMazo.abanico * abre.value}deg` },
        { scale: escalaDeProfundidad(d) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents={esActual ? 'auto' : 'none'}
      accessibilityElementsHidden={!esActual}
      importantForAccessibility={esActual ? 'auto' : 'no-hide-descendants'}
      style={[styles.carta, { height: alto }, estilo]}
    >
      <CartaFrase
        entry={entry}
        activa={esActual}
        alto={alto}
        ancho={ancho}
        sonando={esActual ? sonando : null}
        onSonar={onSonar}
        guardada={guardada}
        onSiguiente={onSiguiente}
        onGuardar={onGuardar}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.velo, velo]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  carta: { position: 'absolute', top: 0, left: 0, right: 0, transformOrigin: '50% 100%' },
  velo: { backgroundColor: color.surface, borderRadius: radius.lg },
});
