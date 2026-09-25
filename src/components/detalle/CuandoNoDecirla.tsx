import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/base/Icon';
import { color, font, radius, space } from '@/theme';

/** Grosor del filo izquierdo del bloque. */
const FILO = 3;

interface Props {
  texto: string;
}

/**
 * «Cuándo NO decirla»: el aviso más importante de la ficha. Fondo ámbar suave
 * (`riskWarnSoft`), un filo izquierdo de 3 px en `riskWarn` y el ícono `warning`:
 * se lee como advertencia aunque no se distinga el color. Ámbar, no rojo: el rojo
 * es solo para el lenguaje explícito.
 */
export function CuandoNoDecirla({ texto }: Props) {
  return (
    <View style={styles.bloque} accessible accessibilityRole="text" accessibilityLabel={`Cuándo no decirla. ${texto}`}>
      <View style={styles.filo} />
      <View style={styles.cabeza}>
        <Icon name="warning" size="md" color={color.riskWarn} />
        <Text style={styles.titulo}>Cuándo NO decirla</Text>
      </View>
      <Text style={styles.cuerpo}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: {
    backgroundColor: color.riskWarnSoft,
    borderRadius: radius.md,
    overflow: 'hidden',
    padding: space.lg,
    paddingLeft: space.lg + FILO,
    gap: space.sm,
  },
  filo: { position: 'absolute', left: 0, top: 0, bottom: 0, width: FILO, backgroundColor: color.riskWarn },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titulo: {
    fontSize: font.size.xs,
    color: color.riskWarn,
    fontFamily: font.family.bodyStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cuerpo: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.5,
  },
});
