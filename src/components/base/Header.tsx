import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, space } from '@/theme';
import { IconButton } from './IconButton';

interface Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, subtitle, onBack, onClose, right }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.side}>
        {onBack ? (
          <IconButton
            simbolo="←"
            etiqueta="Atrás"
            tamano="sm"
            onPress={onBack}
          />
        ) : null}
      </View>

      <View style={styles.center}>
        {title ? (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideRight]}>
        {right ??
          (onClose ? (
            <IconButton
              simbolo="✕"
              etiqueta="Salir"
              tamano="sm"
              onPress={onClose}
            />
          ) : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginBottom: space.md,
  },
  /*
   * El lado izquierdo es fijo: siempre cabe una flecha y nada más.
   *
   * El derecho NO puede ser fijo. Con width 56 una etiqueta como
   * "Saltar" se recortaba a "S…", y el usuario veía un botón que no
   * decía nada. Ahora crece con su contenido y solo reserva un mínimo.
   */
  side: { width: 56, justifyContent: 'center' },
  sideRight: { width: undefined, minWidth: 56, alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  title: {
    textAlign: 'center',
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
  },
  subtitle: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
