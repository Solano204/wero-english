import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { color, font, space } from '@/theme';

interface Props {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  emoji?: string;
}

/**
 * Estado vacío. Nunca se deja una pantalla en blanco: si no hay nada,
 * hay que decir por qué y qué hacer en su lugar.
 */
export function EmptyState({ title, body, actionLabel, onAction, emoji }: Props) {
  return (
    <View style={styles.wrap}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" />
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
  emoji: { fontFamily: font.family.body, fontSize: 44 },
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
