import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { color, motionCaza, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

const LADO = 14;
const GROSOR = 2;

interface EsquinaProps {
  arriba: boolean;
  izquierda: boolean;
  cierre: SharedValue<number>;
}

function Esquina({ arriba, izquierda, cierre }: EsquinaProps) {
  const estilo = useAnimatedStyle(() => {
    const afuera = (1 - cierre.value) * motionCaza.reticulo;
    return {
      opacity: cierre.value,
      transform: [{ translateX: (izquierda ? -1 : 1) * afuera }, { translateY: (arriba ? -1 : 1) * afuera }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.esquina,
        arriba ? styles.arriba : styles.abajo,
        izquierda ? styles.izquierda : styles.derecha,
        estilo,
      ]}
    />
  );
}

interface Props {
  /** El renglón está marcado: las esquinas se cierran sobre él; al desmarcarlo se abren. */
  activo: boolean;
}

/**
 * El retículo: cuatro esquinas de `accent` que se cierran sobre el renglón marcado en `rapido`, como fijar un
 * blanco. Es solo luz encima (no recibe toques). Con «reducir movimiento» no existe: queda el borde del renglón.
 */
export function Reticulo({ activo }: Props) {
  const reducido = useMovimientoReducido();
  const cierre = useSharedValue(0);

  useEffect(() => {
    cierre.value = withTiming(activo ? 1 : 0, {
      duration: motionDuration.rapido,
      easing: activo ? motionEasing.entrar : motionEasing.salir,
    });
  }, [activo, cierre]);

  if (reducido) return null;
  return (
    <>
      <Esquina arriba izquierda cierre={cierre} />
      <Esquina arriba izquierda={false} cierre={cierre} />
      <Esquina arriba={false} izquierda cierre={cierre} />
      <Esquina arriba={false} izquierda={false} cierre={cierre} />
    </>
  );
}

const styles = StyleSheet.create({
  esquina: { position: 'absolute', width: LADO, height: LADO, borderColor: color.accent },
  arriba: { top: -GROSOR, borderTopWidth: GROSOR },
  abajo: { bottom: -GROSOR, borderBottomWidth: GROSOR },
  izquierda: { left: -GROSOR, borderLeftWidth: GROSOR },
  derecha: { right: -GROSOR, borderRightWidth: GROSOR },
});
