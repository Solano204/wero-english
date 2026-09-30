import React, { useEffect, useRef, type ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useVisto } from '@/shared/hooks/useVisibilidad';
import { motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** Cuánto sube un bloque al aparecer (dp). */
const SUBE = 8;

interface Props {
  /** El scroll de la pantalla: el bloque aparece al entrar a la vista. */
  scrollY: SharedValue<number>;
  /** Espera (ms) antes de aparecer, para escalonar varios bloques. */
  retraso?: number;
  children: ReactNode;
}

/**
 * Un bloque que aparece al entrar a la vista: fundido y una subida de 8 dp en
 * `lento` con ease-out, una sola vez. Los que ya están a la vista al abrir la
 * pantalla aparecen con su `retraso`; los de más abajo, cuando el scroll llega. Con
 * reducir movimiento ya están en su lugar.
 */
export function Aparece({ scrollY, retraso = 0, children }: Props) {
  const reducido = useMovimientoReducido();
  const { ref, alAcomodar, visto } = useVisto(scrollY);
  const avance = useSharedValue(reducido ? 1 : 0);
  const montado = useRef(Date.now());

  useEffect(() => {
    if (!visto) return;
    // El retraso escalona lo que ya estaba a la vista al abrir; lo que aparece al hacer scroll no espera.
    const espera = Date.now() - montado.current < motionDuration.coreografia ? retraso : 0;
    avance.set(reducido
      ? 1
      : withDelay(espera, withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar })));
  }, [visto, reducido, retraso, avance]);

  const anim = useAnimatedStyle(() => ({
    opacity: avance.get(),
    transform: [{ translateY: (1 - avance.get()) * SUBE }],
  }));

  return (
    <Animated.View ref={ref} collapsable={false} onLayout={alAcomodar} style={anim}>
      {children}
    </Animated.View>
  );
}
