import { useEffect, type Dispatch, type SetStateAction } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { motionDuration, motionEasing, motionSpring } from '@/theme';

/** Cuánto se aplastan las fichas al chocar con el piso (scaleY): vuelven a 1 con rebote. */
const APLASTE = 0.92;

/**
 * El choque contra el piso de una ronda perdida: el aplastamiento de las fichas y el destello del piso, y
 * el estilo de la fila que cae. Se llama DESPUÉS del arranque de la caída (ver el efecto de abajo).
 */
export function useChoqueCaida(
  finRonda: 'fallo' | 'piso' | null,
  reducido: boolean,
  altoPista: number,
  y: SharedValue<number>,
  setAnimandoFin: Dispatch<SetStateAction<boolean>>
) {
  const aplasta = useSharedValue(1);
  const golpe = useSharedValue(0);

  // Fin de una ronda perdida. Ficha equivocada: primero se ve el veredicto (`lento`) y luego las dos caen
  // suavemente al piso. Piso: las fichas ya llegaron y se aplastan un poco con rebote mientras el piso
  // destella. Va después del arranque de la caída para correr tras su limpieza, que cancela `y`. Con
  // «reducir movimiento» solo cambian los colores.
  useEffect(() => {
    if (!finRonda || reducido) return undefined;
    let duracion = motionDuration.lento;
    if (finRonda === 'fallo') {
      y.value = withDelay(
        motionDuration.lento,
        withTiming(altoPista, { duration: motionDuration.escena, easing: motionEasing.salir })
      );
      duracion += motionDuration.escena;
    } else {
      aplasta.value = APLASTE;
      aplasta.value = withSpring(1, motionSpring.rebote);
      golpe.value = withSequence(
        withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
      );
    }
    const t = setTimeout(() => setAnimandoFin(false), duracion);
    return () => clearTimeout(t);
  }, [finRonda, reducido, altoPista, y, aplasta, golpe]);

  // Con «reducir movimiento» las fichas no caen: se quedan arriba y una barra cuenta el tiempo.
  const anim = useAnimatedStyle(() => ({
    transform: reducido ? [] : [{ translateY: y.value }, { scaleY: aplasta.value }],
  }));

  return { golpe, anim };
}
