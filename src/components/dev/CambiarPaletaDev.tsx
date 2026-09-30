import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Presionable } from '@/components/base/Presionable';
import { color, font, radius, space } from '@/theme';
import { leerPaletaDev, usarPaletaDev } from '@/theme/paletaActiva';
import type { PaletaId } from '@/theme/paletas';

/** El orden del botón: las tres candidatas. Mantener presionado vuelve a la de hoy (D). */
const CICLO: PaletaId[] = ['E', 'F', 'G'];

/**
 * Solo en __DEV__: un botón chico en la esquina para cambiar de paleta sin volver a Ajustes mientras recorres la app.
 * Cada toque pasa a la siguiente (E, F, G) y recarga; mantener presionado vuelve a D.
 */
export function CambiarPaletaDev() {
  const { top } = useSafeAreaInsets();
  const actual = leerPaletaDev().paleta;
  const siguiente = CICLO[(CICLO.indexOf(actual) + 1) % CICLO.length] ?? 'E';
  return (
    <Presionable
      onPress={() => usarPaletaDev(siguiente)}
      onLongPress={() => usarPaletaDev('D')}
      accessibilityRole="button"
      accessibilityLabel={`Cambiar paleta: ahora ${actual}, sigue ${siguiente}`}
      style={[styles.boton, { top: top + space.xs }]}
    >
      <Text style={styles.etiqueta}>{`Paleta ${actual}`}</Text>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  boton: {
    position: 'absolute',
    right: space.sm,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceHigh,
    borderWidth: 1,
    borderColor: color.borderStrong,
    opacity: 0.85,
  },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.text },
});
