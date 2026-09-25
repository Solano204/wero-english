import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import type { Palabra } from '@/domain/marcas';
import { color, font, space } from '@/theme';
import type { VozEnVivo } from './useVozEnVivo';

// Copias locales: un worklet captura estos textos, no el objeto de tema entero.
const ACTUAL = color.text;
const DICHA = color.textMuted;
const PENDIENTE = color.textFaint;

/** Cuánto se levanta la palabra que se está diciendo (dp). */
const LEVANTE = 2;
/** Ventana en la que una palabra pasa de un color al siguiente (s). */
const ENTRADA_S = 0.08;
const SALIDA_S = 0.12;

type Tamano = 'display' | 'lg' | 'md';

interface PalabraProps {
  palabra: Palabra;
  voz: VozEnVivo;
  tamano: Tamano;
}

function PalabraKaraoke({ palabra, voz, tamano }: PalabraProps) {
  const { pos, activa, reducido } = voz;
  const { inicio, sig, hablada } = palabra;

  const estilo = useAnimatedStyle(() => {
    const k = activa.value;
    // En reposo la frase se lee entera en su color de siempre.
    if (k === 0) return { color: ACTUAL, transform: [{ translateY: 0 }] };
    const p = pos.value;
    let base: string;
    if (!hablada) base = DICHA;
    else if (reducido) base = p < inicio ? PENDIENTE : p < sig ? ACTUAL : DICHA;
    else {
      base = interpolateColor(
        p,
        [inicio - ENTRADA_S, inicio, sig, sig + SALIDA_S],
        [PENDIENTE, ACTUAL, ACTUAL, DICHA]
      );
    }
    const levante =
      hablada && !reducido
        ? interpolate(p, [inicio - ENTRADA_S, inicio, sig, sig + SALIDA_S], [0, -LEVANTE, -LEVANTE, 0], Extrapolation.CLAMP)
        : 0;
    return {
      color: k === 1 ? base : interpolateColor(k, [0, 1], [ACTUAL, base]),
      transform: [{ translateY: levante * k }],
    };
  });

  return <Animated.Text style={[ESTILO_PALABRA[tamano], estilo]}>{palabra.texto}</Animated.Text>;
}

interface Props {
  palabras: Palabra[];
  voz: VozEnVivo;
  /** `display` (34, la frase héroe de Detalle), `lg` (28, Estudio) o `md` (22). */
  tamano?: Tamano;
}

/**
 * La frase con karaoke: cada palabra cambia de color al decirse (la que suena
 * en `text`, las dichas en `textMuted`, las que faltan en `textFaint`). Las
 * palabras que no se dicen (una nota entre paréntesis) no se iluminan. Va en
 * el hilo de UI, sin re-render de React. Para el lector de pantalla es una sola
 * frase; las palabras sueltas no se anuncian.
 */
export function FraseKaraoke({ palabras, voz, tamano = 'lg' }: Props) {
  const frase = palabras.map((p) => p.texto).join(' ');
  return (
    <View style={styles.fila} accessible accessibilityRole="text" accessibilityLabel={frase}>
      {palabras.map((p, i) => (
        <PalabraKaraoke key={`${i}-${p.texto}`} palabra={p} voz={voz} tamano={tamano} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // El espacio entre palabras va como hueco de la fila y no como carácter: a los lados de cada renglón no sobra nada.
  fila: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: space.sm },
  palabraDisplay: {
    fontSize: font.size.display,
    letterSpacing: font.size.display * -0.015,
    fontFamily: font.family.display,
    lineHeight: font.size.display * 1.2,
    color: ACTUAL,
  },
  palabraLg: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    lineHeight: font.size.xxl * 1.25,
    color: ACTUAL,
  },
  palabraMd: {
    fontFamily: font.family.body,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.3,
    color: ACTUAL,
  },
});

const ESTILO_PALABRA = { display: styles.palabraDisplay, lg: styles.palabraLg, md: styles.palabraMd } as const;
