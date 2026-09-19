import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, radius, space } from '@/theme';

/**
 * Marca de "esto está cerrado" para las listas.
 *
 * Va en la tarjeta, no encima de ella: tapar la portada con un candado
 * esconde justo lo que tiene que dar ganas de abrirlo.
 */
export function CandadoBadge({ texto = 'Con anuncio' }: { texto?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.glifo}>◈</Text>
      <Text style={styles.txt}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: color.accentSoft,
  },
  glifo: { color: color.accent, fontFamily: font.family.body, fontSize: font.size.xs },
  txt: { color: color.accent, fontSize: font.size.xs, fontFamily: font.family.bodyStrong },
});
