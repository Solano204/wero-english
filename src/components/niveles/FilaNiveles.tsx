import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { EstadoNivel, NivelVista } from '@/domain/niveles';
import { layout } from '@/theme';
import { CeldaNivel } from './CeldaNivel';

/** Hueco entre celdas, en los dos sentidos (escala 4/8). */
export const HUECO_CELDAS = 8;

interface Props {
  niveles: NivelVista[];
  lado: number;
  onPress: (n: number, estado: EstadoNivel) => void;
}

/**
 * Un renglón de la lista: hasta cinco celdas. Su alto es `lado + HUECO_CELDAS`, exacto,
 * porque la lista calcula con él dónde está cada cosa (`getItemLayout`) y a dónde
 * llevar el scroll.
 */
export const FilaNiveles = memo(function FilaNiveles({ niveles, lado, onPress }: Props) {
  return (
    <View style={[styles.fila, { height: lado + HUECO_CELDAS }]}>
      {niveles.map((v) => (
        <CeldaNivel key={v.n} n={v.n} estado={v.estado} estrellas={v.estrellas} lado={lado} onPress={onPress} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: HUECO_CELDAS,
    paddingHorizontal: layout.screenPad,
  },
});
