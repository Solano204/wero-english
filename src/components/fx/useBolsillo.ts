import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { motionDuration, motionEasing, motionRadio } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';

/**
 * El modo bolsillo de Modo oído. Con `activo` (la secuencia está sonando), a los `motionRadio.bolsillo` ms sin
 * tocar la pantalla `bolsillo` pasa a true y `brillo` baja de 1 a `1 - velo` (para OLED: menos luz en lo que no
 * hace falta ver). Quien lo usa aplica `brillo` como opacidad a todo menos al anillo y la frase. `despertar` se
 * llama en cada toque: lo regresa y vuelve a armar la cuenta. Sin `activo` (en pausa, sin foco o en segundo
 * plano) no hay cuenta ni velo. Nada de esto toca el audio. Con «reducir movimiento» el brillo cambia sin fundido.
 */
export function useBolsillo(activo: boolean): { bolsillo: boolean; brillo: SharedValue<number>; despertar: () => void } {
  const reducido = useMovimientoReducido();
  const [bolsillo, setBolsillo] = useState(false);
  const brillo = useSharedValue(1);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiar = useCallback(() => {
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = null;
  }, []);

  const armar = useCallback(() => {
    limpiar();
    if (activo) reloj.current = setTimeout(() => setBolsillo(true), motionRadio.bolsillo);
  }, [activo, limpiar]);

  const despertar = useCallback(() => {
    setBolsillo(false);
    armar();
  }, [armar]);

  useEffect(() => {
    if (activo) armar();
    else {
      limpiar();
      setBolsillo(false);
    }
    return limpiar;
  }, [activo, armar, limpiar]);

  useEffect(() => {
    const destino = bolsillo ? 1 - motionRadio.velo : 1;
    brillo.value = reducido ? destino : withTiming(destino, { duration: motionDuration.lento, easing: motionEasing.entrar });
  }, [bolsillo, reducido, brillo]);

  return { bolsillo, brillo, despertar };
}
