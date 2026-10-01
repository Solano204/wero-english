import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Presionable } from '@/shared/ui';
import { PuntoMundo } from '@/shared/ui/PuntoMundo';
import { color, escalon, font, layout, space } from '@/theme';
import { miles, plural } from '@/domain/texto';
import { BarraFina } from '@/shared/ui/BarraFina';
import { textoMundo } from '@/features/progreso/logic/datos';

interface Props {
  nombre: string;
  /** El color del mundo: su ícono y la barra fina (COLOR-1). */
  tinte: string;
  /** Id del mundo, para su ícono. */
  mundo?: string;
  dominadas: number;
  total: number;
  fraccion: number;
  primera: boolean;
  indice: number;
  /** Las barras se llenan, escalonadas, al pasar a true (la sección entró a la vista). */
  activo: boolean;
  onPress: () => void;
}

/**
 * Una fila de «Por mundo»: punto del mundo, nombre, «N de M» y una barra fina en su
 * color. Con 0 dominadas la barra queda vacía, pero la fila se queda. Toda la fila lleva
 * a la pantalla del mundo.
 */
export function FilaMundo({ nombre, tinte, mundo, dominadas, total, fraccion, primera, indice, activo, onPress }: Props) {
  return (
    <Presionable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}: ${dominadas} de ${miles(total)} ${plural(total, 'frase dominada', 'frases dominadas')}`}
      style={[styles.fila, !primera && styles.separada]}
    >
      <View style={styles.cabeza}>
        <View style={styles.nombre}>
          <PuntoMundo tinte={tinte} mundo={mundo} />
          <Text style={styles.titulo}>{nombre}</Text>
        </View>
        <Text style={styles.cuenta}>{textoMundo({ dominadas, total })}</Text>
      </View>
      <BarraFina fraccion={fraccion} tinte={tinte} activo={activo} retraso={escalon(indice)} />
    </Presionable>
  );
}

const styles = StyleSheet.create({
  fila: {
    minHeight: layout.tapMin,
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  separada: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  nombre: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  titulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text, flexShrink: 1 },
  cuenta: { fontFamily: font.family.body, fontSize: font.size.sm, fontVariant: ['tabular-nums'], color: color.textMuted },
});
