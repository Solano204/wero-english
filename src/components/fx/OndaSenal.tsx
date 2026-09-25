import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, LinearGradient, Path, vec, type SkSize } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { motionDuration, motionEasing, motionSenal, senal, space } from '@/theme';
import { FxSeguro } from './FxSeguro';
import { ZONA, trazarBarras } from './onda';
import { useReloj, useSenalActiva } from './useSenalActiva';

/** Fotograma de la onda cuando no se mueve (reducir movimiento). */
const FASE_QUIETA = 0.25;
/** Las barras se ven como una textura de fondo: no compiten con el texto. */
const OPACIDAD = 0.4;

interface Props {
  /** 0.06 a 1. Sale de las frases pendientes (`energiaOnda`). */
  energia: number;
  /** 0 = línea plana, 1 = ondas: la señal que se conecta al entrar. */
  encendido: SharedValue<number>;
  /** 0 a 1: microruido de interferencia (120 ms al tocar la tarjeta). */
  interferencia: SharedValue<number>;
}

function Barras({ energia, encendido, interferencia }: Props) {
  const { activo, reducido } = useSenalActiva();
  const fase = useReloj(motionSenal.respiro, { activo, reducido, faseQuieta: FASE_QUIETA });
  const nivel = useSharedValue(energia);
  const tam = useSharedValue<SkSize>({ width: 0, height: 0 });

  useEffect(() => {
    nivel.value = reducido
      ? energia
      : withTiming(energia, { duration: motionDuration.lento, easing: motionEasing.entrar });
  }, [energia, reducido, nivel]);

  const trazo = useDerivedValue(() => {
    const { width, height } = tam.value;
    return trazarBarras({
      ancho: width,
      alto: height,
      fase: fase.value,
      energia: nivel.value * encendido.value,
      ruido: interferencia.value,
      margenAbajo: space.lg,
    });
  });
  const inicio = useDerivedValue(() => vec(0, tam.value.height));
  const fin = useDerivedValue(() => vec(0, tam.value.height * (1 - ZONA)));

  return (
    <Canvas style={StyleSheet.absoluteFill} onSize={tam} pointerEvents="none" accessible={false}>
      <Path path={trazo} opacity={OPACIDAD}>
        <LinearGradient start={inicio} end={fin} colors={senal} />
      </Path>
    </Canvas>
  );
}

/**
 * Ecualizador de fondo de la consola de HOY: 28 barras que respiran en un
 * ciclo de 4 s. La amplitud sale de las frases pendientes; con 0 queda casi
 * plana. Va a un lado del texto, en la parte baja, para no restar contraste.
 */
export function OndaSenal(props: Props) {
  return (
    <FxSeguro>
      <Barras {...props} />
    </FxSeguro>
  );
}
