import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useMovimientoReducido } from '@/utils';

/** Tope de un paso del reloj: al volver de una pausa larga no se salta la fase. */
const MAX_PASO_MS = 100;

/**
 * Único punto donde se decide si un efecto de la señal puede moverse (MOT-4 y
 * MOT-5): la pantalla tiene foco, la app está en primer plano y el sistema no
 * pidió reducir movimiento.
 */
export function useSenalActiva(): { activo: boolean; reducido: boolean } {
  const enfocada = useIsFocused();
  const reducido = useMovimientoReducido();
  const [primerPlano, setPrimerPlano] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => setPrimerPlano(estado === 'active'));
    return () => sub.remove();
  }, []);

  return { activo: enfocada && primerPlano && !reducido, reducido };
}

interface OpcionesReloj {
  activo: boolean;
  reducido: boolean;
  /** Fase (0 a 1) en la que queda el fotograma limpio con "reducir movimiento". */
  faseQuieta?: number;
  /** 1 mientras el elemento está en pantalla: fuera de ella el reloj se detiene (MOT-4). */
  visible?: SharedValue<number>;
  /** Una sola pasada y queda en el fotograma limpio, en vez de un bucle. */
  unaVez?: boolean;
}

/**
 * Fase 0 a 1 que avanza en el hilo de UI mientras `activo`. Apagado, el reloj no
 * corre ni un cuadro: no cuesta nada. Con `reducido` queda en `faseQuieta`.
 */
export function useReloj(
  periodo: number,
  { activo, reducido, faseQuieta = 0, visible, unaVez = false }: OpcionesReloj
): SharedValue<number> {
  const fase = useSharedValue(unaVez ? 0 : faseQuieta);
  const acumulado = useSharedValue(0);
  const control = useFrameCallback((cuadro) => {
    'worklet';
    if (visible && visible.value === 0) return;
    if (unaVez && acumulado.value >= periodo) return;
    const paso = Math.min(cuadro.timeSincePreviousFrame ?? 0, MAX_PASO_MS);
    acumulado.value += paso;
    if (unaVez && acumulado.value >= periodo) {
      fase.value = faseQuieta;
      return;
    }
    fase.value = (fase.value + paso / periodo) % 1;
  }, false);

  useEffect(() => {
    control.setActive(activo);
    return () => control.setActive(false);
  }, [activo, control]);

  useEffect(() => {
    if (reducido) fase.value = faseQuieta;
  }, [reducido, faseQuieta, fase]);

  return fase;
}
