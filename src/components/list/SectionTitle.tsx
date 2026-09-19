import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, space } from '@/theme';

interface Props {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionTitle({ title, count, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        {title}
        {typeof count === 'number' ? (
          <Text style={styles.count}>  {count}</Text>
        ) : null}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
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
  title: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: color.text,
  },
  count: { fontSize: font.size.sm, color: color.textFaint },
  action: {
    fontSize: font.size.sm,
    color: color.accent,
    fontWeight: font.weight.semibold,
  },
});
