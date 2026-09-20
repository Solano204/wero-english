import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, radius, space } from '@/theme';
import type { Registro, Vulgaridad } from '@/types';

type Tone = 'neutral' | 'warn' | 'strong' | 'accent' | 'good';

interface Props {
  label: string;
  tone?: Tone;
  small?: boolean;
}

export function Badge({ label, tone = 'neutral', small = false }: Props) {
  return (
    <View style={[styles.wrap, tones[tone].wrap, small && styles.small]}>
      <Text
        style={[styles.text, tones[tone].text, small && styles.textSmall]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * El badge de riesgo social. Es la señal más importante de la tarjeta:
 * el usuario tiene que ver de un vistazo si la frase lo puede meter en
 * problemas, sin leer la nota completa.
 */
export function RiskBadge({ vulgaridad }: { vulgaridad: Vulgaridad }) {
  if (vulgaridad === 0) return null;
  return (
    <Badge
      label={vulgaridad === 2 ? 'Solo con amigos' : 'Cuidado dónde'}
      tone={vulgaridad === 2 ? 'strong' : 'warn'}
      small
    />
  );
}

const REGISTRO_LABEL: Record<Registro, string> = {
  formal: 'Formal',
  neutro: 'Neutro',
  informal: 'Informal',
  muy_informal: 'Muy informal',
};

export function RegistroBadge({ registro }: { registro: Registro }) {
  return <Badge label={REGISTRO_LABEL[registro]} tone="neutral" small />;
}

export function LevelBadge({ nivel }: { nivel: 1 | 2 | 3 }) {
  const labels = ['Fácil', 'Media', 'Difícil'] as const;
  return <Badge label={labels[nivel - 1] ?? 'Media'} tone="neutral" small />;
}

const tones: Record<Tone, { wrap: object; text: object }> = {
  neutral: {
    wrap: { backgroundColor: color.surfaceHigh },
    text: { color: color.textMuted },
  },
  warn: {
    wrap: { backgroundColor: color.riskWarnSoft },
    text: { color: color.riskWarn },
  },
  strong: {
    wrap: { backgroundColor: color.riskStrongSoft },
    text: { color: color.riskStrong },
  },
  accent: {
    wrap: { backgroundColor: color.accentSoft },
    text: { color: color.accent },
  },
  good: {
    wrap: { backgroundColor: color.correctSoft },
    text: { color: color.correct },
  },
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  small: { paddingHorizontal: space.sm, paddingVertical: space.xs },
  text: {
    fontSize: font.size.sm,
    fontFamily: font.family.bodyStrong,
  },
  textSmall: { fontFamily: font.family.body, fontSize: font.size.xs },
});
