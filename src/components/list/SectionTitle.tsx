import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, space } from '@/theme';
import { Presionable } from '@/components/base';

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
