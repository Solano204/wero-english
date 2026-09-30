import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { color, motionEasing, motionMalentendido } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

const PASOS = motionMalentendido.glitchPasos;
const DESPLAZO = motionMalentendido.glitchDesplazo;
/** Hacia dónde salta cada capa en cada cuadro, en fracciones de `glitchDesplazo`: cambia de lado a saltos y termina en 0. */
const SALTOS = [-1, 0.6, -0.4, 1, -0.7, 0.3, -0.2, 0];
// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const TEXTO = color.text;
const AMBAR = color.wrong;

/** El cuadro del glitch en el que va `g` (de 0 a `PASOS - 1`). */
function cuadro(g: number): number {
  'worklet';
  return Math.min(PASOS - 1, Math.floor(g * PASOS));
}

interface FranjaProps {
  texto: string;
  estilo: TextStyle;
  g: SharedValue<number>;
  /** Dónde empieza la franja y cuánto mide, en dp del texto. */
  desde: number;
  alto: number;
  /** De qué lado salta: 1 o -1. */
  lado: 1 | -1;
}

/** Una franja horizontal del texto que se corre de lado a saltos: una copia del texto recortada a esa banda. */
function Franja({ texto, estilo, g, desde, alto, lado }: FranjaProps) {
  const anim = useAnimatedStyle(() => {
    const k = 1 - g.get();
    return { opacity: k, transform: [{ translateX: lado * (SALTOS[cuadro(g.get())] ?? 0) * DESPLAZO * 2 * k }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.franja, { top: desde, height: alto }, anim]}
    >
      <Text style={[estilo, styles.copia, { top: -desde }]}>{texto}</Text>
    </Animated.View>
  );
}

interface CopiaProps {
  texto: string;
  estilo: TextStyle;
  g: SharedValue<number>;
  /** Hacia dónde se corre la copia ámbar (1 o -1) y cuánta opacidad tiene al empezar. */
  lado: 1 | -1;
  opacidad: number;
}

/** La aberración: una copia del texto en ámbar, corrida de lado, que se desvanece y vuelve a su lugar. */
function Aberracion({ texto, estilo, g, lado, opacidad }: CopiaProps) {
  const anim = useAnimatedStyle(() => {
    const k = 1 - g.get();
    return { opacity: opacidad * k, transform: [{ translateX: lado * DESPLAZO * k }] };
  });
  return (
    <Animated.Text
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[estilo, styles.copia, { color: AMBAR }, anim]}
    >
      {texto}
    </Animated.Text>
  );
}

interface Props {
  texto: string;
  /** El estilo del texto en reposo (en ámbar): las capas del glitch lo copian. */
  estilo: TextStyle;
  /** Sube en 1 para lanzar el glitch (una sola vez por cada subida). En 0 no ha pasado nada. */
  disparo: number;
}

/**
 * El texto que llega con la señal rota: aparece con un glitch de `motionMalentendido.glitch` ms y se asienta. Son varias
 * capas del mismo texto (la base, dos copias ámbar corridas de lado y dos franjas que saltan de lado a cuadros) y solo se
 * mueven con `transform` y `opacity`: sin shaders. La base parpadea y pasa de `text` al ámbar del reposo. Con «reducir
 * movimiento» es solo el texto, ya asentado. Solo la capa base la lee el lector de pantalla.
 */
export function SenalRota({ texto, estilo, disparo }: Props) {
  const reducido = useMovimientoReducido();
  const g = useSharedValue(1);
  const [alto, setAlto] = useState(0);

  useEffect(() => {
    if (disparo === 0 || reducido) return undefined;
    g.set(0);
    g.set(withTiming(1, { duration: motionMalentendido.glitch, easing: motionEasing.lineal }));
    return () => cancelAnimation(g);
  }, [disparo, reducido, g]);

  const base = useAnimatedStyle(() => {
    const paso = cuadro(g.get());
    const k = 1 - g.get();
    return {
      color: interpolateColor(g.get(), [0.55, 1], [TEXTO, AMBAR]),
      opacity: paso >= PASOS - 2 || paso % 2 === 1 ? 1 : 0.6,
      transform: [{ translateX: (SALTOS[paso] ?? 0) * DESPLAZO * 0.4 * k }],
    };
  });

  if (reducido) return <Text style={[estilo, { color: AMBAR }]}>{texto}</Text>;
  return (
    <View onLayout={(e) => setAlto(e.nativeEvent.layout.height)}>
      <Animated.Text style={[estilo, base]}>{texto}</Animated.Text>
      <Aberracion texto={texto} estilo={estilo} g={g} lado={1} opacidad={0.75} />
      <Aberracion texto={texto} estilo={estilo} g={g} lado={-1} opacidad={0.5} />
      {alto > 0 ? (
        <>
          <Franja texto={texto} estilo={estilo} g={g} desde={alto * 0.18} alto={Math.max(4, alto * 0.22)} lado={1} />
          <Franja texto={texto} estilo={estilo} g={g} desde={alto * 0.6} alto={Math.max(4, alto * 0.2)} lado={-1} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Las copias ocupan el mismo lugar que el texto base: parten de la misma esquina y miden lo mismo.
  copia: { position: 'absolute', left: 0, right: 0, top: 0 },
  franja: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
});
