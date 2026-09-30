import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Icon, type IconName } from '@/shared/ui';
import { avanceGuardar, avanceSiguiente } from '@/domain/mazo';
import { color, font, radius, space } from '@/theme';

// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const REPOSO_FONDO = color.surface;
const REPOSO_BORDE = color.borderStrong;
const LISTO_FONDO = color.accentSoft;
const LISTO_BORDE = color.accent;
/** Desde qué avance (0 a 1) la píldora empieza a tomar el color de «ya cuenta». */
const CERCA = 0.7;
/** Lo que se desliza la píldora hacia su lugar mientras aparece, en dp. */
const DESLIZA = 12;

interface PildoraProps {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  cual: 'siguiente' | 'guardar';
  etiqueta: string;
  icono: IconName;
}

function Pildora({ tx, ty, cual, etiqueta, icono }: PildoraProps) {
  const estilo = useAnimatedStyle(() => {
    const a = cual === 'siguiente' ? avanceSiguiente(tx.get(), ty.get()) : avanceGuardar(tx.get(), ty.get());
    const desliza = (1 - a) * DESLIZA;
    return {
      opacity: a,
      backgroundColor: interpolateColor(a, [CERCA, 1], [REPOSO_FONDO, LISTO_FONDO]),
      borderColor: interpolateColor(a, [CERCA, 1], [REPOSO_BORDE, LISTO_BORDE]),
      transform: [cual === 'siguiente' ? { translateX: -desliza } : { translateY: -desliza }, { scale: 0.92 + 0.08 * a }],
    };
  });
  return (
    <Animated.View style={[styles.pildora, cual === 'siguiente' ? styles.izquierda : styles.arriba, estilo]}>
      <Icon name={icono} size="md" color={color.accent} />
      <Text style={styles.etiqueta}>{etiqueta}</Text>
    </Animated.View>
  );
}

interface Props {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}

/**
 * Las dos pistas del arrastre, sobre el borde por donde se va la carta: «Siguiente» a la izquierda y «Guardar» arriba,
 * cada una con su ícono. Aparecen con lo que ya se arrastró hacia ese lado (solo se enciende la del eje que va) y, al
 * llegar al umbral, la píldora toma el color de `accent`: soltar ahí cuenta. Es solo dibujo: no recibe toques y el lector
 * de pantalla no la lee (las acciones «Siguiente» y «Guardar» están en la carta y en el pie).
 */
export function IndicadorArrastre({ tx, ty }: Props) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Pildora tx={tx} ty={ty} cual="siguiente" etiqueta="Siguiente" icono="back" />
      <Pildora tx={tx} ty={ty} cual="guardar" etiqueta="Guardar" icono="star" />
    </View>
  );
}

const styles = StyleSheet.create({
  pildora: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    opacity: 0,
  },
  izquierda: { left: space.sm, top: '45%' },
  arriba: { top: space.sm, alignSelf: 'center' },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.text },
});
