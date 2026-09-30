import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Canvas, LinearGradient, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { color, medidor, motionDuration, motionEasing, motionSenal, senal, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import { FxSeguro } from './FxSeguro';

/** Cuánto se ilumina el medidor completo en el destello de reto cumplido. */
const OPACIDAD_DESTELLO = 0.5;
const PASO = medidor.segmento + medidor.separacion;
const SEPARACION_FILAS = space.sm;

interface Props {
  valor: number;
  /** Segmentos: uno por acierto de la meta. */
  total: number;
  /** Arranca al pasar a true (cuando el medidor entra a la vista). */
  activo: boolean;
  /** Un solo destello del medidor completo. Quien lo usa decide que sea una vez por semana. */
  celebrar: boolean;
  /** El número real: los segmentos son decorativos. */
  etiqueta: string;
}

interface Segmento {
  x: number;
  y: number;
}

function Segmentos({ valor, total, ancho, activo, celebrar }: Omit<Props, 'etiqueta'> & { ancho: number }) {
  const reducido = useMovimientoReducido();
  const filas = total * PASO - medidor.separacion <= ancho ? 1 : 2;
  const porFila = Math.ceil(total / filas);
  const alto = filas * medidor.alto + (filas - 1) * SEPARACION_FILAS;

  const segmentos = useMemo<Segmento[]>(
    () =>
      Array.from({ length: total }, (_, i) => ({
        x: (i % porFila) * PASO,
        y: Math.floor(i / porFila) * (medidor.alto + SEPARACION_FILAS),
      })),
    [total, porFila]
  );
  const apagados = useMemo(() => {
    const trazo = Skia.Path.Make();
    for (const s of segmentos) {
      trazo.addRRect(
        Skia.RRectXY(Skia.XYWHRect(s.x, s.y, medidor.segmento, medidor.alto), medidor.segmento / 2, medidor.segmento / 2)
      );
    }
    return trazo;
  }, [segmentos]);

  const encendidos = useSharedValue(0);
  const destello = useSharedValue(0);

  useEffect(() => {
    if (!activo) return;
    encendidos.value = reducido
      ? valor
      : withTiming(valor, { duration: motionSenal.medidor, easing: motionEasing.entrar });
  }, [activo, valor, reducido, encendidos]);

  useEffect(() => {
    if (!celebrar || !activo || reducido) return;
    // El destello llega cuando el último segmento ya se encendió.
    destello.value = withDelay(
      motionSenal.medidor,
      withSequence(
        withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionDuration.lento, easing: motionEasing.salir })
      )
    );
  }, [celebrar, activo, reducido, destello]);

  const encendido = useDerivedValue(() => {
    const trazo = Skia.Path.Make();
    const n = Math.min(total, Math.floor(encendidos.value + 0.0001));
    for (let i = 0; i < n; i++) {
      const s = segmentos[i];
      if (!s) break;
      trazo.addRRect(
        Skia.RRectXY(Skia.XYWHRect(s.x, s.y, medidor.segmento, medidor.alto), medidor.segmento / 2, medidor.segmento / 2)
      );
    }
    return trazo;
  });
  // El degradado abarca lo encendido (no la fila entera): con pocos aciertos también se ve de punta a punta.
  const fin = useDerivedValue(() =>
    vec(Math.max(1, Math.min(encendidos.value, porFila) * PASO - medidor.separacion), 0)
  );
  const opacidadDestello = useDerivedValue(() => destello.value * OPACIDAD_DESTELLO);

  return (
    <Canvas style={{ width: ancho, height: alto }} pointerEvents="none" accessible={false}>
      <Path path={apagados} color={color.trackFondo} />
      <Path path={encendido}>
        <LinearGradient start={vec(0, 0)} end={fin} colors={senal} />
      </Path>
      <Rect x={0} y={0} width={ancho} height={alto} color={color.accent100} opacity={opacidadDestello} />
    </Canvas>
  );
}

/**
 * Medidor segmentado tipo VU de consola: un segmento vertical por acierto de la
 * meta. Los encendidos van en el degradado `senal` y se prenden de izquierda a
 * derecha en `motionSenal.medidor` (≤ 600 ms); los apagados, en `trackFondo`.
 * Sin bucles: solo se mueve al entrar (MOT-3). Va en dos filas si no cabe en una.
 */
export function MedidorVU({ etiqueta, ...resto }: Props) {
  const [ancho, setAncho] = useState(0);
  return (
    <View
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min: 0, max: resto.total, now: Math.min(resto.valor, resto.total) }}
    >
      {ancho > 0 ? (
        <FxSeguro>
          <Segmentos {...resto} ancho={ancho} />
        </FxSeguro>
      ) : null}
    </View>
  );
}
