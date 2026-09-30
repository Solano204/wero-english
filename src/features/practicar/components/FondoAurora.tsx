import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Fill, Shader, Skia, type SkRuntimeEffect } from '@shopify/react-native-skia';
import Animated, {
  Extrapolation,
  SensorType,
  interpolate,
  useAnimatedReaction,
  useAnimatedSensor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { aurora, color, grano, motionDuration, motionEasing, motionSenal } from '@/theme';
import { FxSeguro } from '@/shared/ui/fx/FxSeguro';
import { useReloj, useSenalActiva } from '@/shared/ui/fx/useSenalActiva';

/** Alto de la región que ilumina la aurora, desde el borde de arriba. */
const REGION = 520;
/** Posición del sol dentro del ancho de pantalla. */
const SOL_X = 0.14;
/** Fotograma de la aurora cuando no se mueve (reducir movimiento). */
const FASE_QUIETA = 0.18;
/**
 * Cada cuánto avanza la aurora. Un ciclo dura 20 s: a 60 fps cada cuadro la movía menos de un
 * píxel, y redibujar el shader en cada uno le quitaba al hilo de UI tiempo del scroll de Practicar.
 */
const PASO_AURORA_MS = 50;
/** Muestreo del sensor de rotación. */
const SENSOR_MS = 50;
/** Inclinación (rad) que lleva el desplazamiento al máximo. */
const RANGO_INCLINACION = 0.3;

/**
 * Ruido suave que fluye por un círculo (por eso el ciclo cierra sin costura),
 * enmascarado por un halo que nace del sol. Premultiplicado: la opacidad
 * máxima de la aurora sale de `maxOp`.
 */
const AURORA = `
uniform float2 tam;
uniform float fase;
uniform float2 sol;
uniform float maxOp;
uniform float4 tinte;

float hash(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}
float ruido(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = mix(hash(i), hash(i + float2(1.0, 0.0)), u.x);
  float b = mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x);
  return mix(a, b, u.y);
}
half4 main(float2 xy) {
  float2 uv = xy / tam;
  float a = fase * 6.2831853;
  float2 q = uv * 2.6 + float2(cos(a), sin(a)) * 0.7;
  float n = ruido(q) * 0.6 + ruido(q * 2.1 + 3.7) * 0.4;
  float d = distance(xy, sol) / (tam.x * 1.25);
  float halo = 1.0 - smoothstep(0.0, 1.0, d);
  float v = clamp(halo * (0.3 + 0.7 * n), 0.0, 1.0) * maxOp;
  return half4(half3(tinte.rgb * v), half(v));
}
`;

const GRANO = `
float hash(float2 p) {
  return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453);
}
half4 main(float2 xy) {
  float n = hash(xy);
  return half4(half3(n), 1.0);
}
`;

/** Cambio mínimo (dp) del destino del paralaje para arrancar otra animación. */
const UMBRAL_PARALAJE = 0.25;

/** Mueve `dx` y `dy` con la inclinación del teléfono. Solo existe montado mientras la señal está activa. */
function ParalajeGiro({ dx, dy }: { dx: SharedValue<number>; dy: SharedValue<number> }) {
  const sensor = useAnimatedSensor(SensorType.ROTATION, {
    interval: SENSOR_MS,
    adjustToInterfaceOrientation: false,
  });
  const listo = useSharedValue(false);
  const baseRoll = useSharedValue(0);
  const basePitch = useSharedValue(0);
  const destinoX = useSharedValue(0);
  const destinoY = useSharedValue(0);

  useAnimatedReaction(
    () => sensor.sensor.get(),
    (v) => {
      // La postura con la que se abre la pantalla es el punto de reposo.
      if (!listo.get()) {
        baseRoll.set(v.roll);
        basePitch.set(v.pitch);
        listo.set(true);
      }
      const opciones = { duration: motionDuration.rapido, easing: motionEasing.entrar };
      const x = interpolate(v.roll - baseRoll.get(), [-RANGO_INCLINACION, RANGO_INCLINACION], [-aurora.paralaje, aurora.paralaje], Extrapolation.CLAMP);
      const y = interpolate(v.pitch - basePitch.get(), [-RANGO_INCLINACION, RANGO_INCLINACION], [-aurora.paralaje, aurora.paralaje], Extrapolation.CLAMP);
      // Con el teléfono quieto el sensor solo trae ruido: no se arranca otra animación por menos de un cuarto de dp,
      // que no se ve, en cada lectura (cada 50 ms).
      if (Math.abs(x - destinoX.get()) >= UMBRAL_PARALAJE) {
        destinoX.set(x);
        dx.set(withTiming(x, opciones));
      }
      if (Math.abs(y - destinoY.get()) >= UMBRAL_PARALAJE) {
        destinoY.set(y);
        dy.set(withTiming(y, opciones));
      }
    }
  );
  return null;
}

/**
 * Los dos shaders y el tinte, compilados una sola vez para toda la app (no por montaje ni por render): Practicar se
 * vuelve a montar al cerrar sesión o al volver de Boot. Si Skia no puede compilarlos, quedan en null y el fondo se
 * queda como estaba.
 */
let compilados: { aurora: SkRuntimeEffect | null; grano: SkRuntimeEffect | null; tinte: number[] } | null = null;
function recursos() {
  if (!compilados) {
    try {
      compilados = {
        aurora: Skia.RuntimeEffect.Make(AURORA),
        grano: Skia.RuntimeEffect.Make(GRANO),
        tinte: Array.from(Skia.Color(color.accent)),
      };
    } catch {
      compilados = { aurora: null, grano: null, tinte: [0, 0, 0, 0] };
    }
  }
  return compilados;
}

function GranoFino() {
  const fuente = recursos().grano;
  if (!fuente) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      <Fill opacity={grano.opacidad}>
        <Shader source={fuente} />
      </Fill>
    </Canvas>
  );
}

function LuzAurora() {
  const { width } = useWindowDimensions();
  const { activo, reducido } = useSenalActiva();
  const fase = useReloj(motionSenal.aurora, { activo, reducido, faseQuieta: FASE_QUIETA, cadaMs: PASO_AURORA_MS });
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);

  const { aurora: fuente, tinte } = recursos();

  const sangre = aurora.paralaje;
  const ancho = Math.round((width + sangre * 2) * aurora.resolucion);
  const alto = Math.round((REGION + sangre * 2) * aurora.resolucion);
  const sol = ([(width * SOL_X + sangre) * aurora.resolucion, sangre * aurora.resolucion]);

  const uniformes = useDerivedValue(() => ({
    tam: [ancho, alto],
    fase: fase.get(),
    sol,
    maxOp: aurora.opacidadMax,
    tinte,
  }));

  useEffect(() => {
    if (activo) return;
    dx.set(withTiming(0, { duration: motionDuration.base, easing: motionEasing.entrar }));
    dy.set(withTiming(0, { duration: motionDuration.base, easing: motionEasing.entrar }));
  }, [activo, dx, dy]);

  const desplazamiento = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.get() }, { translateY: dy.get() }],
  }));

  if (!fuente) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.aurora,
        { top: -sangre, left: -sangre, width: width + sangre * 2, height: REGION + sangre * 2 },
        desplazamiento,
      ]}
    >
      <Canvas
        style={{
          width: ancho,
          height: alto,
          transformOrigin: 'top left',
          transform: [{ scale: 1 / aurora.resolucion }],
        }}
        pointerEvents="none"
        accessible={false}
      >
        <Fill>
          <Shader source={fuente} uniforms={uniformes} />
        </Fill>
      </Canvas>
      {activo ? <ParalajeGiro dx={dx} dy={dy} /> : null}
    </Animated.View>
  );
}

/**
 * Fondo vivo de Practicar: una aurora azul que nace del sol (arriba a la
 * izquierda), un ciclo de 20 s, con parallax del giroscopio y grano fino.
 *
 * Solo la aurora se anima, y a un cuarto de resolución. Se apaga con "reducir
 * movimiento", sin foco o con la app en segundo plano (MOT-4 y MOT-5); si
 * Skia o el sensor fallan, el fondo queda como estaba.
 */
export function FondoAurora() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <FxSeguro>
        <LuzAurora />
      </FxSeguro>
      <FxSeguro>
        <GranoFino />
      </FxSeguro>
    </View>
  );
}

const styles = StyleSheet.create({
  aurora: { position: 'absolute', overflow: 'hidden' },
});
