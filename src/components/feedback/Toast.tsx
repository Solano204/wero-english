import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, font, radius, space } from '@/theme';

interface Props {
  message: string | null;
  tone?: 'info' | 'error' | 'good';
}

/** Aviso breve arriba. No bloquea, no pide confirmación. */
export function Toast({ message, tone = 'info' }: Props) {
  const y = useSharedValue(-80);

  useEffect(() => {
    y.value = withTiming(message ? 0 : -80, { duration: 220 });
  }, [message, y]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: y.value === 0 ? 1 : 0,
  }));

  if (!message) return null;

  return (
    <Animated.View style={[styles.wrap, tones[tone], anim]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const tones = {
  info: { backgroundColor: color.surfaceHigh },
  error: { backgroundColor: color.riskStrongSoft },
  good: { backgroundColor: color.correctSoft },
} as const;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: space.lg,
    left: space.lg,
    right: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    zIndex: 100,
  },
  text: { color: color.text, fontFamily: font.family.body, fontSize: font.size.sm, textAlign: 'center' },
});
