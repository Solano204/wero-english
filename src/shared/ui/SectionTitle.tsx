import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, space, text } from '@/theme';
import { Presionable } from '@/shared/ui';

interface Props {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * `lista` (por omisión): título de 18 con margen, para pantallas de listas. `bloque`: h2 sin
   * margen, para bloques ya separados por `gap` (Practicar).
   */
  variante?: 'lista' | 'bloque';
  /** Dato corto a la derecha, sm (p. ej. un contador). */
  derecha?: string;
}

export function SectionTitle({ title, count, actionLabel, onAction, variante = 'lista', derecha }: Props) {
  const bloque = variante === 'bloque';
  return (
    <View style={[styles.wrap, bloque && styles.wrapBloque]}>
      <Text style={bloque ? text.h2 : styles.title} accessibilityRole="header">
        {title}
        {typeof count === 'number' ? (
          <Text style={styles.count}>  {count}</Text>
        ) : null}
      </Text>
      {derecha ? <Text style={styles.count}>{derecha}</Text> : null}
      {actionLabel && onAction ? (
        <Presionable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={styles.action}>{actionLabel}</Text>
        </Presionable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
    marginTop: space.md,
  },
  wrapBloque: { marginTop: 0, marginBottom: 0 },
  title: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
  },
  count: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textFaint },
  action: {
    fontSize: font.size.sm,
    color: color.accent,
    fontFamily: font.family.bodyStrong,
  },
});
