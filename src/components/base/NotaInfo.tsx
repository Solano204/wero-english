import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { color, radius, space } from '@/theme';
import { Icon } from './Icon';

/** Ancho del filo de la izquierda, en dp. */
const ANCHO_FILO = 3;

/**
 * Una nota aparte del texto: una tarjeta `surfaceAlt` con el ícono `info` en `accent` y un filo de 3 px en `accent` a la
 * izquierda. Es lo que marca «Ojo» en Gramática y la nota de cada forma de Phrasal verbs. El texto va en `children`.
 */
export function NotaInfo({ children }: { children: ReactNode }) {
  return (
    <View style={styles.nota}>
      <View style={styles.filo} />
      <Icon name="info" size="md" color={color.accent} />
      <View style={styles.texto}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  nota: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.md,
    overflow: 'hidden',
    paddingVertical: space.lg,
    paddingRight: space.lg,
    paddingLeft: space.lg + ANCHO_FILO,
  },
  filo: { position: 'absolute', top: 0, bottom: 0, left: 0, width: ANCHO_FILO, backgroundColor: color.accent },
  texto: { flex: 1 },
});
