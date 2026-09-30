import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/base/Icon';
import { Presionable } from '@/components/base/Presionable';
import { PuntoMundo } from '@/components/list';
import { color, font, layout, radius, space } from '@/theme';

interface Props {
  nombre: string;
  bloque: string;
  /** El color del mundo: solo el punto (COLOR-1). */
  tinte: string;
  /** Id del mundo, para su ícono. */
  mundo?: string;
  onPress: () => void;
}

/**
 * «Dónde vive» la frase: una fila tocable con el punto del mundo, su nombre, el bloque
 * y un chevron. Toda la fila abre la pantalla del mundo. Es la misma fila de «Por
 * mundo» en Progreso (punto y nombre), sin el avance: aquí lo que importa es a dónde lleva.
 */
export function FilaDondeVive({ nombre, bloque, tinte, mundo, onPress }: Props) {
  return (
    <Presionable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Dónde vive: ${nombre}, ${bloque}`}
      accessibilityHint="Abre el mundo"
      style={styles.fila}
    >
      <PuntoMundo tinte={tinte} mundo={mundo} />
      <View style={styles.textos}>
        <Text style={styles.nombre}>{nombre}</Text>
        <Text style={styles.bloque}>{bloque}</Text>
      </View>
      <Icon name="chevron-right" size="md" color={color.textFaint} />
    </Presionable>
  );
}

const styles = StyleSheet.create({
  fila: {
    minHeight: layout.tapMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  textos: { flex: 1, gap: space.xs },
  nombre: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  bloque: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted, lineHeight: font.size.sm * 1.4 },
});
