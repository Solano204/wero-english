import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Path, Skia, vec } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color, motionDuration, motionEasing, motionSenal, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { FxSeguro } from './FxSeguro';

/** Aire alrededor del anillo: por ahí se abre el destello de meta cumplida. */
const MARGEN = space.md;
/** Progreso mínimo que se dibuja: con menos, el cabo redondo pintaría un punto. */
const PROGRESO_VISIBLE = 0.002;

interface Props {
  valor: number;
  total: number;
  diametro: number;
  trazo: number;
  /** Retraso (ms) de la primera vez que se llena; los cambios siguientes avanzan sin espera. */
  retraso?: number;
  /** Dispara el destello. Quien lo usa decide que sea una vez por día. */
  celebrar?: boolean;
  /** El número real: el lienzo es decorativo. */
  etiqueta: string;
  children?: ReactNode;
}

function Arco({ valor, total, diametro, trazo, retraso = 0, celebrar = false }: Omit<Props, 'etiqueta' | 'children'>) {
  const reducido = useMovimientoReducido();
  const lado = diametro + MARGEN * 2;
  const centro = lado / 2;
  const radio = (diametro - trazo) / 2;
  const meta = total > 0 ? Math.min(1, Math.max(0, valor) / total) : 0;

  const avance = useSharedValue(0);
  const destello = useSharedValue(0);
  const primeraVez = useRef(true);

  const circulo = useMemo(() => {
    const trazado = Skia.Path.Make();
    trazado.addCircle(centro, centro, radio);
    return trazado;
  }, [centro, radio]);

  useEffect(() => {
    if (reducido) {
      avance.value = meta;
      return;
    }
    const espera = primeraVez.current ? retraso : 0;
    primeraVez.current = false;
    avance.value = withDelay(
      espera,
      withTiming(meta, { duration: motionSenal.anillo, easing: motionEasing.entrar })
    );
  }, [meta, retraso, reducido, avance]);

  useEffect(() => {
    if (!celebrar || reducido) return;
    // El destello llega cuando el arco ya cerró.
    destello.value = withDelay(
      motionSenal.anillo,
      withSequence(
        withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionDuration.rapido })
      )
    );
  }, [celebrar, reducido, destello]);

  const visible = useDerivedValue(() => (avance.value > PROGRESO_VISIBLE ? 1 : 0));
  const radioDestello = useDerivedValue(() => radio + destello.value * MARGEN);
  const opacidadDestello = useDerivedValue(() => (destello.value > 0 ? 1 - destello.value : 0));

  return (
    <Canvas style={{ width: lado, height: lado }} pointerEvents="none" accessible={false}>
      <Circle cx={centro} cy={centro} r={radio} style="stroke" strokeWidth={trazo} color={color.contraste700} />
      <Group transform={[{ rotate: -Math.PI / 2 }]} origin={vec(centro, centro)}>
        <Path
          path={circulo}
          style="stroke"
          strokeWidth={trazo}
          strokeCap="round"
          color={color.accent}
          start={0}
          end={avance}
          opacity={visible}
        />
      </Group>
      <Circle
        cx={centro}
        cy={centro}
        r={radioDestello}
        style="stroke"
        strokeWidth={trazo}
        color={color.accent100}
        opacity={opacidadDestello}
      />
    </Canvas>
  );
}

/**
 * Anillo de progreso: el arco se llena de 0 a su valor real (900 ms, ease-out)
 * y, si `celebrar`, suelta un destello azul una sola vez. El número real va en
 * `accessibilityLabel`; el lienzo es decorativo. `children` va centrado.
 */
export function AnilloMeta({ etiqueta, children, ...arco }: Props) {
  const lado = arco.diametro + MARGEN * 2;
  return (
    <View
      style={{ width: lado, height: lado, margin: -MARGEN }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min: 0, max: arco.total, now: Math.min(arco.valor, arco.total) }}
    >
      <FxSeguro>
        <Arco {...arco} />
      </FxSeguro>
      {children ? <View style={styles.centro}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
