import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { color, font, space } from '@/theme';

interface Props {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
  /** El color del ícono; por omisión `textMuted`. Un vacío que es una buena noticia (nada se atora) lo pone en `correct`. */
  iconColor?: string;
}

/**
 * Estado vacío. Nunca se deja una pantalla en blanco: si no hay nada,
 * hay que decir por qué y qué hacer en su lugar.
 */
export function EmptyState({ title, body, actionLabel, onAction, icon, iconColor }: Props) {
  return (
    <View style={styles.wrap}>
      {icon ? <Icon name={icon} size="xl" color={iconColor ?? color.textMuted} /> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
  title: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: font.size.md * 1.5,
    maxWidth: 320,
  },
});
