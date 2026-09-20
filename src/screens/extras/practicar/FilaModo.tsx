import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Icon, Presionable } from '@/components/base';
import { color, font, layout, space } from '@/theme';

interface Props {
  titulo: string;
  dato?: string | null;
  primera: boolean;
  onPress: () => void;
}

/** Renglón compacto de un grupo: nombre, dato opcional y chevron. 48 dp como mínimo. */
export function FilaModo({ titulo, dato, primera, onPress }: Props) {
  return (
    <Presionable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.fila, !primera && styles.separada]}
    >
      <Text style={styles.nombre} numberOfLines={2}>
        {titulo}
      </Text>
      {dato ? (
        <Text style={styles.dato} numberOfLines={1}>
          {dato}
        </Text>
      ) : null}
      <Icon name="chevron-right" size="md" color={color.textFaint} />
    </Presionable>
  );
}

const styles = StyleSheet.create({
  fila: {
    minHeight: layout.tapMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  separada: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  nombre: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.md,
    color: color.text,
  },
  dato: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textFaint },
});
