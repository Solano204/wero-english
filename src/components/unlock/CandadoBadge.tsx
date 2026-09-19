import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/base';
import { color, font, radius } from '@/theme';

/**
 * Marca de "esto está cerrado" para las listas.
 *
 * Va en la tarjeta, no encima de ella: tapar la portada con un candado
 * esconde justo lo que tiene que dar ganas de abrirlo.
 */
export function CandadoBadge({ texto = 'Con anuncio' }: { texto?: string }) {
  return (
    <View style={styles.wrap}>
      <Icon name="lock" size="sm" color={color.accent} />
      <Text style={styles.txt}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: color.accentSoft,
  },
  txt: { color: color.accent, fontSize: font.size.xs, fontFamily: font.family.bodyStrong },
});
