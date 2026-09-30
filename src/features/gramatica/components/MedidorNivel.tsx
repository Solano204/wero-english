import React from 'react';
import { StyleSheet, View } from 'react-native';
import { color, radius, space } from '@/theme';

/** Alto de la primera barra y cuánto crece cada una respecto de la anterior, en dp. */
const ALTO_BASE = 6;
const ALTO_PASO = 3;
const ANCHO_BARRA = 4;

interface Props {
  /** Cuántas barras van encendidas, de 1 a `total`. */
  nivel: number;
  total: number;
  /** En la leyenda: es un dibujo de ejemplo y el lector de pantalla no lo lee. */
  decorativo?: boolean;
}

/**
 * Nivel de un tema como barras que suben, encendidas en `accent`. Se lee de un vistazo sin el «N2» de antes; con el
 * lector de pantalla se oye «Nivel 2 de 5».
 */
export function MedidorNivel({ nivel, total, decorativo = false }: Props) {
  const barras = Array.from({ length: total }, (_, i) => i);
  return (
    <View
      style={styles.fila}
      accessible={!decorativo}
      accessibilityRole={decorativo ? undefined : 'image'}
      accessibilityLabel={decorativo ? undefined : `Nivel ${nivel} de ${total}`}
      accessibilityElementsHidden={decorativo}
      importantForAccessibility={decorativo ? 'no-hide-descendants' : 'auto'}
    >
      {barras.map((i) => (
        <View
          key={i}
          style={[styles.barra, { height: ALTO_BASE + i * ALTO_PASO }, i < nivel ? styles.encendida : styles.apagada]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  barra: { width: ANCHO_BARRA, borderRadius: radius.pill },
  encendida: { backgroundColor: color.accent },
  apagada: { backgroundColor: color.borderStrong },
});
