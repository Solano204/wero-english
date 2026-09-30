import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { EncabezadoComprimido, Icon } from '@/shared/ui';
import { color, font, radius, space } from '@/theme';
import { conteo } from '@/domain/texto';

export { ALTO_ENCABEZADO } from '@/shared/ui';

interface Props {
  scrollY: SharedValue<number>;
  racha: number;
  /** Primera vez por sesión: el título abre la coreografía con un fundido. */
  entrada?: boolean;
}

function ChipRacha({ dias }: { dias: number }) {
  return (
    <View style={styles.chip} accessible accessibilityLabel={`Racha: ${conteo(dias, 'día')}`}>
      <Icon name="fire" size="md" color={color.star} />
      <Text style={styles.chipNumero}>{dias}</Text>
    </View>
  );
}

/** «Practicar» grande que se comprime al hacer scroll, con el chip de racha a la derecha. */
export function EncabezadoPracticar({ scrollY, racha, entrada = false }: Props) {
  return (
    <EncabezadoComprimido
      titulo="Practicar"
      scrollY={scrollY}
      entrada={entrada}
      derecha={racha > 0 ? <ChipRacha dias={racha} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  chipNumero: {
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.md,
    fontVariant: ['tabular-nums'],
    color: color.star,
  },
});
