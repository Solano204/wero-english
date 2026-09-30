import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Hueso } from '@/components/esqueleto';
import { color, font, layout, radius, space } from '@/theme';

/** Alto de una línea de `font.size.md` en el renglón (lo que ocupa la frase y la traducción). */
const LINEA = Math.round(font.size.md * 1.35);

/**
 * `EntryRow` (variante compacta) mientras carga: la misma caja, el mismo relleno y el botón
 * de audio en su área táctil de 48. Va dentro de un `ProveedorEsqueleto` de la pantalla.
 */
export function EntryRowHueso({ conAudio = true }: { conAudio?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <View style={styles.linea}>
          <Hueso width="70%" height={font.size.md} />
        </View>
        <View style={styles.linea}>
          <Hueso width="50%" height={font.size.md - 2} />
        </View>
      </View>
      {conAudio ? (
        <View style={styles.toque}>
          <Hueso width={36} height={34} radius={radius.pill} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Igual que `EntryRow.row`.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  body: { flex: 1, gap: space.xs },
  linea: { height: LINEA, justifyContent: 'center' },
  toque: { minWidth: layout.tapMin, minHeight: layout.tapMin, alignItems: 'center', justifyContent: 'center' },
});
