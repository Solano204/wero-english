import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { Presionable } from '@/shared/ui/Presionable';
import { color, font, layout, space } from '@/theme';

interface Props {
  icono: IconName;
  titulo: string;
  /** Una línea que dice qué hace. */
  detalle: string;
  onPress: () => void;
  /** Las que borran: el ícono y el título en el color de error. */
  borra?: boolean;
}

/** Un renglón de la sección Legal: ícono, título y qué hace, con la flecha de «entra aquí». Mide 48 dp o más. */
export function FilaLegal({ icono, titulo, detalle, onPress, borra = false }: Props) {
  return (
    <Presionable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={detalle}
      style={styles.fila}
    >
      <Icon name={icono} size="md" color={borra ? color.wrong : color.accent} />
      <View style={styles.textos}>
        <Text style={[styles.titulo, borra && styles.tituloBorra]}>{titulo}</Text>
        <Text style={styles.detalle}>{detalle}</Text>
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
    paddingVertical: space.sm,
  },
  textos: { flex: 1, gap: space.xs },
  titulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  tituloBorra: { color: color.wrong },
  detalle: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted, lineHeight: font.size.sm * 1.5 },
});
