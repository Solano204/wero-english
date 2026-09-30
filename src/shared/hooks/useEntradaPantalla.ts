import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

const yaEntraron = new Set<string>();

/** true solo la primera vez que esa pantalla se monta en la sesión de la app. */
export function tomarEntrada(pantalla: string): boolean {
  if (yaEntraron.has(pantalla)) return false;
  yaEntraron.add(pantalla);
  return true;
}

/**
 * Primera vez por sesión: coreografía de entrada (`primera`). Las visitas siguientes
 * de la misma sesión solo hacen un fundido de 150 ms (`estiloFundido`).
 */
export function useEntradaPantalla(pantalla: string) {
  const [primera] = useState(() => tomarEntrada(pantalla));
  const reducido = useMovimientoReducido();
  const fundido = useSharedValue(1);
  const yaEnfoco = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (yaEnfoco.current && !reducido) {
        fundido.set(0);
        fundido.set(withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }));
      }
      yaEnfoco.current = true;
    }, [fundido, reducido])
  );
  const estiloFundido = useAnimatedStyle(() => ({ opacity: fundido.get() }));

  return { primera, estiloFundido };
}
