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

type Tamano = 'display' | 'lg' | 'md' | 'h3';

interface PalabraProps {
  palabra: Palabra;
  voz: VozEnVivo;
  tamano: Tamano;
  /** Va en `accent` y subrayada, sin cambiar de color con la voz (solo se levanta al decirse). */
  destacada: boolean;
  /** En reposo la frase va en `textMuted` en vez de `text` (cuando suena la otra lengua). */
  apagada: boolean;
}

function PalabraKaraoke({ palabra, voz, tamano, destacada, apagada }: PalabraProps) {
  const { pos, activa, reducido } = voz;
  const { inicio, sig, hablada } = palabra;
  const reposo = apagada ? DICHA : ACTUAL;

  const estilo = useAnimatedStyle(() => {
    const k = activa.value;
    // En reposo la frase se lee entera en su color de siempre.
    if (k === 0) return destacada ? { transform: [{ translateY: 0 }] } : { color: reposo, transform: [{ translateY: 0 }] };
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
    const transform = [{ translateY: levante * k }];
    if (destacada) return { transform };
    return { color: k === 1 ? base : interpolateColor(k, [0, 1], [reposo, base]), transform };
  });

  return (
    <Animated.Text style={[ESTILO_PALABRA[tamano], apagada && styles.apagada, destacada && styles.destacada, estilo]}>
      {palabra.texto}
    </Animated.Text>
  );
}

interface Props {
  palabras: Palabra[];
  voz: VozEnVivo;
  /** `display` (34, la frase héroe de Detalle), `lg` (28, Estudio), `md` (22) o `h3` (18, la frase de Cázala). */
  tamano?: Tamano;
  /** Índices de las palabras que van resaltadas en `accent` y subrayadas (las reducciones de Cázala). */
  destacadas?: ReadonlySet<number>;
  /** En reposo (sin sonar) la frase va en `textMuted`: la lengua que no está sonando (Modo oído). */
  apagada?: boolean;
  /** `inicio` alinea las palabras a la izquierda (una frase dentro de una tarjeta); por omisión van centradas. */
  alinear?: 'centro' | 'inicio';
}

/**
 * La frase con karaoke: cada palabra cambia de color al decirse (la que suena
 * en `text`, las dichas en `textMuted`, las que faltan en `textFaint`). Las
 * palabras que no se dicen (una nota entre paréntesis) no se iluminan. Va en
 * el hilo de UI, sin re-render de React. Para el lector de pantalla es una sola
 * frase; las palabras sueltas no se anuncian.
 */
export function FraseKaraoke({ palabras, voz, tamano = 'lg', destacadas, apagada = false, alinear = 'centro' }: Props) {
  const frase = palabras.map((p) => p.texto).join(' ');
  return (
    <View
      style={alinear === 'inicio' ? [styles.fila, styles.filaInicio] : styles.fila}
      accessible
      accessibilityRole="text"
      accessibilityLabel={frase}
    >
      {palabras.map((p, i) => (
        <PalabraKaraoke
          key={`${i}-${p.texto}`}
          palabra={p}
          voz={voz}
          tamano={tamano}
          destacada={destacadas?.has(i) ?? false}
          apagada={apagada}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // El espacio entre palabras va como hueco de la fila y no como carácter: a los lados de cada renglón no sobra nada.
  fila: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: space.sm },
  filaInicio: { justifyContent: 'flex-start' },
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
  palabraH3: {
    fontFamily: font.family.heading,
    fontSize: font.size.lg,
    lineHeight: font.size.lg * 1.4,
    color: ACTUAL,
  },
  destacada: { color: color.accent, textDecorationLine: 'underline' },
  apagada: { color: DICHA },
});

const ESTILO_PALABRA = {
  display: styles.palabraDisplay,
  lg: styles.palabraLg,
  md: styles.palabraMd,
  h3: styles.palabraH3,
} as const;
