import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AudioButton } from './AudioButton';
import { color, font, space } from '@/theme';
import type { Entry } from '@/types';

interface Props {
  entry: Entry;
  showIpa?: boolean;
  showAudio?: boolean;
  /** Revela la traducción y su audio. Apaga en ejercicios donde la
   *  traducción ES la respuesta que el usuario tiene que adivinar. */
  showSpanish?: boolean;
  size?: 'md' | 'lg';
  /** Texto alternativo, por ejemplo la frase con hueco. */
  override?: string;
}

/**
 * La frase en inglés con su IPA y su audio.
 *
 * El IPA va debajo y en gris: es apoyo, no protagonista. Si compite en
 * peso visual con la frase, el usuario lee símbolos en vez de palabras.
 */
export function PhraseBlock({
  entry,
  showIpa = true,
  showAudio = true,
  showSpanish = false,
  size = 'lg',
  override,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text
        style={[styles.phrase, size === 'md' && styles.phraseMd]}
        accessibilityRole="text"
      >
        {override ?? entry.phrase}
      </Text>

      {showIpa && entry.ipa ? (
        <Text style={styles.ipa} numberOfLines={2}>
          {entry.ipa}
        </Text>
      ) : null}

      {showAudio && entry.audio_en ? (
        <View style={styles.audioRow}>
          <AudioButton path={entry.audio_en} size="md" />
          <AudioButton path={entry.audio_en} size="md" slow label="Lento" />
        </View>
      ) : null}

      {showSpanish ? (
        <View style={styles.spanishRow}>
          <Text style={styles.spanish}>{entry.spanish_main}</Text>
          {showAudio && entry.audio_es ? (
            <AudioButton path={entry.audio_es} size="md" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, alignItems: 'center' },
  phrase: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: color.text,
    textAlign: 'center',
    lineHeight: font.size.xxl * 1.25,
  },
  phraseMd: { fontSize: font.size.xl, lineHeight: font.size.xl * 1.3 },
  ipa: {
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  audioRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
  spanishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  spanish: {
    fontSize: font.size.lg,
    color: color.textMuted,
    textAlign: 'center',
  },
});
