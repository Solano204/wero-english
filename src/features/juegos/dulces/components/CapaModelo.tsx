import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MARCA_DULCES, ANIMACION_DULCES } from '@/config/dulces';
import { color, font, radius } from '@/theme';

interface Props {
  /** El tablero del MODELO (el del dominio), no el que dibujan las piezas. */
  celdas: readonly number[];
  cols: number;
  rows: number;
  lado: number;
  hueco: number;
}

/**
 * Capa de depuración de Dulces: encima de cada celda, el color que el MODELO cree que hay ahí (su número). Si una
 * pieza dibujada no coincide con el número de su celda, o hay una celda con número y sin pieza, la vista se separó
 * del modelo. Se enciende y apaga con una pulsación larga sobre «jugadas»; también funciona en el APK release. Arriba
 * dice la marca de esta versión del juego, para saber si el APK instalado trae los últimos cambios.
 */
export function CapaModelo({ celdas, cols, rows, lado, hueco }: Props) {
  const paso = lado + hueco;
  const vacias = celdas.filter((v) => v < 0).length;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {celdas.map((v, i) => (
        <View
          key={i}
          style={[
            styles.celda,
            { left: (i % cols) * paso, top: Math.floor(i / cols) * paso, width: lado, height: lado },
            v < 0 && styles.vacia,
          ]}
        >
          <Text style={styles.numero}>{v < 0 ? '×' : v}</Text>
        </View>
      ))}
      <View style={[styles.marca, { top: rows * paso }]}>
        <Text style={styles.marcaTexto}>
          {MARCA_DULCES} · modelo {cols}×{rows} · vacías {vacias} · animación {ANIMACION_DULCES ? 'sí' : 'no'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  celda: {
    position: 'absolute',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 2,
  },
  vacia: { borderWidth: 2, borderColor: color.wrong, borderRadius: radius.sm },
  numero: {
    minWidth: 16,
    textAlign: 'center',
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.xs,
    color: color.text,
    backgroundColor: color.bg,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  marca: { position: 'absolute', left: 0, right: 0 },
  marcaTexto: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted, textAlign: 'center' },
});
