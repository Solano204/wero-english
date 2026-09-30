import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

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
  /**
   * Publica la fase cada tantos ms en vez de en cada cuadro. Para lo que se mueve tan lento que
   * a 60 fps cada cuadro cambia menos de un píxel (la aurora): el lienzo se redibuja menos veces
   * y el hilo de UI queda libre para el scroll.
   */
  cadaMs?: number;
}

/**
 * Fase 0 a 1 que avanza en el hilo de UI mientras `activo`. Apagado, el reloj no
 * corre ni un cuadro: no cuesta nada. Con `reducido` queda en `faseQuieta`.
 */
export function useReloj(
  periodo: number,
  { activo, reducido, faseQuieta = 0, visible, unaVez = false, cadaMs = 0 }: OpcionesReloj
): SharedValue<number> {
  const fase = useSharedValue(unaVez ? 0 : faseQuieta);
  const acumulado = useSharedValue(0);
  const pendiente = useSharedValue(0);
  const control = useFrameCallback((cuadro) => {
    'worklet';
    if (visible && visible.get() === 0) return;
    if (unaVez && acumulado.get() >= periodo) return;
    const paso = Math.min(cuadro.timeSincePreviousFrame ?? 0, MAX_PASO_MS);
    acumulado.set(acumulado.get() + paso);
    if (unaVez && acumulado.get() >= periodo) {
      fase.set(faseQuieta);
      return;
    }
    if (cadaMs > 0) {
      pendiente.set(pendiente.get() + paso);
      if (pendiente.get() < cadaMs) return;
      fase.set((fase.get() + pendiente.get() / periodo) % 1);
      pendiente.set(0);
      return;
    }
    fase.set((fase.get() + paso / periodo) % 1);
  }, false);

  useEffect(() => {
    control.setActive(activo);
    return () => control.setActive(false);
  }, [activo, control]);

  useEffect(() => {
    if (reducido) fase.set(faseQuieta);
  }, [reducido, faseQuieta, fase]);

  return fase;
}
