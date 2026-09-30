import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/shared/ui/Icon';
import { radius } from '@/theme';
import { ICONO_MUNDO } from './iconoMundo';

/**
 * La marca de un mundo, en chico: su ícono, en su azul de la escala de mundos (COLOR-1). El color ya no distingue a
 * un mundo de otro (son azules de la misma familia): lo distingue el ícono. Sin `mundo`, o si el mundo no tiene
 * ícono, queda el punto. Decorativo: el nombre del mundo ya está escrito al lado.
 */
export function PuntoMundo({ tinte, mundo }: { tinte: string; mundo?: string }) {
  const icono = mundo ? ICONO_MUNDO[mundo] : undefined;
  if (icono) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name={icono} size="sm" color={tinte} />
      </View>
    );
  }
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
