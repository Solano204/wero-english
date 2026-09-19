import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, type IconSize } from '@/components/base/Icon';

interface Props {
  /** Cuántas van encendidas. */
  llenas: number;
  total?: number;
  size?: IconSize;
  color: string;
  /** Las apagadas. Si falta, llevan el mismo color y solo cambia el relleno. */
  colorVacia?: string;
  gap?: number;
}

/** Tres posiciones fijas: encendidas con relleno, apagadas solo con contorno. */
export function FilaEstrellas({ llenas, total = 3, size = 'sm', color, colorVacia, gap = 0 }: Props) {
  return (
    <View style={[styles.fila, { gap }]}>
      {Array.from({ length: total }, (_, i) => (
        <Icon
          key={i}
          name={i < llenas ? 'star-filled' : 'star'}
          size={size}
          color={i < llenas ? color : (colorVacia ?? color)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
});
