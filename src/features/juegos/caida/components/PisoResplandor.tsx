import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as haptics from '@/services/haptics';
import { color, motionDuration, motionEasing, radius, resplandorPiso, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { ALTO_PISO, AVISO_EN, MARGEN_PISO, avance, resplandor } from '@/features/juegos/caida/logic/medidas';

/** Alto del resplandor sobre el piso. */
const ALTO_RESPLANDOR = 32;
/** Cuánto suma el pulso del aviso al resplandor. */
const PULSO_BRILLO = 0.5;
// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const APAGADO = color.textFaint;
const ACENTO = color.accent;
const DESTELLO = color.textMuted;

interface Props {
  /** La posición de la fila (0 arriba, `distancia` al tocar el piso): el mismo valor que la mueve. */
  y: SharedValue<number>;
  distancia: number;
  /** El aviso del 75 % solo suena mientras la ronda corre: no tras contestar, cuando las fichas caen solas. */
  armado: boolean;
  /** 0 a 1: el choque de las fichas contra el piso al agotarse el tiempo. El piso destella una vez, en `textMuted`. */
  golpe: SharedValue<number>;
}

/**
 * El piso de Caída: una línea de 4 px al fondo de la pista, en `textFaint` en reposo. Sobre ella
 * un resplandor que crece con la caída (de nada al `accent` al 40 % en el último 30 % del recorrido).
 * Al 75 % da el aviso: un háptico ligero y un solo pulso del piso. Es el aviso, no un castigo:
 * nunca rojo ni ámbar. Todo sale del mismo valor `y` que mueve las fichas, en el hilo de UI y sin
 * setState por cuadro. Con «reducir movimiento» no hay pulso; el resplandor y el háptico se quedan.
 * Si las fichas llegan al piso, este destella una vez en `textMuted` (`golpe`).
 */
export function PisoResplandor({ y, distancia, armado, golpe }: Props) {
  const reducido = useMovimientoReducido();
  const pulso = useSharedValue(0);
  const avisar = useCallback(() => haptics.tapLight(), []);

  // Una sola vez por caída: `y` vuelve a 0 al empezar la ronda siguiente y el aviso se rearma.
  useAnimatedReaction(
    () => avance(y.get(), distancia) >= AVISO_EN,
    (llego, antes) => {
      if (!llego || antes || !armado) return;
      runOnJS(avisar)();
      if (reducido) return;
      pulso.set(withSequence(
        withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
      ));
    },
    [distancia, reducido, armado]
  );

  const brillo = useAnimatedStyle(() => ({
    opacity: Math.min(1, resplandor(avance(y.get(), distancia)) + PULSO_BRILLO * pulso.get()),
  }));
  const linea = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(golpe.get(), [0, 1], [interpolateColor(pulso.get(), [0, 1], [APAGADO, ACENTO]), DESTELLO]),
    transform: [{ scaleY: 1 + pulso.get() + golpe.get() }],
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.resplandor, brillo]}>
        <LinearGradient colors={resplandorPiso} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.piso, linea]} />
    </>
  );
}

const styles = StyleSheet.create({
  resplandor: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: MARGEN_PISO + ALTO_PISO,
    height: ALTO_RESPLANDOR,
  },
  piso: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: MARGEN_PISO,
    height: ALTO_PISO,
    borderRadius: radius.pill,
    backgroundColor: color.textFaint,
  },
});
