import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Circle, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { interpolateColor, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { color, senal } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { FxSeguro } from './FxSeguro';

/** Lo que cuelga un cable flojo, en fracción de su largo y con tope. */
const HOLGURA_FRAC = 0.35;
const HOLGURA_MAX = 56;
const GROSOR = 3;
const GROSOR_BRILLO = 10;
const GROSOR_PULSO = 5;
const OPACIDAD_BRILLO = 0.2;
const LARGO_PULSO = 0.22;
const RADIO_ANCLA = 5;
const RADIO_PUNTA = 4;
// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const ACENTO = color.accent;
const AMBAR = color.wrong;
const LUZ = color.accent100;

interface Props {
  /** Dónde está el ancla (A) y la punta (E) del cable, en dp del lienzo. */
  ax: SharedValue<number>;
  ay: SharedValue<number>;
  ex: SharedValue<number>;
  ey: SharedValue<number>;
  /** 1 es un cable tenso; con menos cuelga. */
  tension: SharedValue<number>;
  /** 0 a 1: cuánto se ve el cable. */
  vis: SharedValue<number>;
  /** 0 a 1: el brillo suave que lo acompaña cuando está tenso (`senal`). */
  brillo: SharedValue<number>;
  /** 0 a 1: cuánto pasó de `senal` a ámbar. */
  ambar: SharedValue<number>;
  /** 0 a 1: hasta dónde llegó el pulso de luz que corre de A a E. */
  pulso: SharedValue<number>;
  /** Cuánto se separa el centro del cable de su recta, en dp y de lado (perpendicular): una vibración. Sin él, no vibra. */
  desvio?: SharedValue<number>;
}

/**
 * El dibujo del cable de Pares: un solo lienzo de Skia con un `SkPath` que se recalcula en el hilo de UI, sin setState por
 * cuadro. El trazo es un degradado `senal` (o ámbar según `ambar`), con un brillo detrás, un pulso de luz que lo recorre y
 * un punto en cada extremo. No mueve nada por su cuenta: quien lo usa anima los valores compartidos. Con «reducir
 * movimiento» no dibuja. Lo usan `CableSenal` (Pares) y la señal que se rompe de Errores que te delatan.
 */
export function CableTrazo({ ax, ay, ex, ey, tension, vis, brillo, ambar, pulso, desvio }: Props) {
  const reducido = useMovimientoReducido();

  const trazo = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const largo = Math.hypot(ex.value - ax.value, ey.value - ay.value);
    if (largo < 0.5) return p;
    const holgura = (1 - tension.value) * Math.min(largo * HOLGURA_FRAC, HOLGURA_MAX);
    const d = desvio ? desvio.value : 0;
    const nx = (-(ey.value - ay.value) / largo) * d;
    const ny = ((ex.value - ax.value) / largo) * d;
    p.moveTo(ax.value, ay.value);
    p.quadTo((ax.value + ex.value) / 2 + nx, (ay.value + ey.value) / 2 + holgura + ny, ex.value, ey.value);
    return p;
  });
  const inicio = useDerivedValue(() => vec(ax.value, ay.value));
  const fin = useDerivedValue(() => vec(ex.value, ey.value));
  const opacidadBrillo = useDerivedValue(() => brillo.value * OPACIDAD_BRILLO * vis.value * (1 - ambar.value));
  const opacidadSenal = useDerivedValue(() => vis.value * (1 - ambar.value));
  const opacidadAmbar = useDerivedValue(() => vis.value * ambar.value);
  const opacidadPulso = useDerivedValue(() => (pulso.value > 0.001 ? vis.value : 0));
  const pulsoInicio = useDerivedValue(() => Math.max(0, pulso.value - LARGO_PULSO));
  const colorPunto = useDerivedValue(() => interpolateColor(ambar.value, [0, 1], [ACENTO, AMBAR]));

  if (reducido) return null;
  return (
    <FxSeguro>
      <Canvas style={styles.lienzo} pointerEvents="none" accessible={false}>
        <Path path={trazo} style="stroke" strokeWidth={GROSOR_BRILLO} strokeCap="round" color={ACENTO} opacity={opacidadBrillo} />
        <Path path={trazo} style="stroke" strokeWidth={GROSOR} strokeCap="round" opacity={opacidadSenal}>
          <LinearGradient start={inicio} end={fin} colors={senal} />
        </Path>
        <Path path={trazo} style="stroke" strokeWidth={GROSOR} strokeCap="round" color={AMBAR} opacity={opacidadAmbar} />
        <Path
          path={trazo}
          style="stroke"
          strokeWidth={GROSOR_PULSO}
          strokeCap="round"
          color={LUZ}
          start={pulsoInicio}
          end={pulso}
          opacity={opacidadPulso}
        />
        <Circle cx={ax} cy={ay} r={RADIO_ANCLA} color={colorPunto} opacity={vis} />
        <Circle cx={ex} cy={ey} r={RADIO_PUNTA} color={colorPunto} opacity={vis} />
      </Canvas>
    </FxSeguro>
  );
}

const styles = StyleSheet.create({
  // Por encima de la ficha elevada (zIndex 1): el cable sale de su centro.
  lienzo: { ...StyleSheet.absoluteFill, zIndex: 2 },
});
