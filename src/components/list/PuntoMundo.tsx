import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius } from '@/theme';

/**
 * El color de un mundo, en chico: un punto junto al nombre. Es lo único que
 * lleva ese color en una tarjeta; el fondo y los botones no lo usan (COLOR-1).
 * Decorativo: el nombre del mundo ya está escrito al lado.
 */
export function PuntoMundo({ tinte }: { tinte: string }) {
  return (
    <View
      style={[styles.punto, { backgroundColor: tinte }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  punto: { width: 8, height: 8, borderRadius: radius.pill },
});
