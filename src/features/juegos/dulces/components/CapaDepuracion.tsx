import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font } from '@/theme';
import type { PiezaVista } from '@/features/juegos/dulces/logic/vistaTablero';

interface Props {
  /** El modelo: color e id de la pieza en cada celda. */
  celdas: readonly number[];
  ids: readonly number[];
  /** Lo que se dibuja. */
  piezas: readonly PiezaVista[];
  cols: number;
  rows: number;
  paso: number;
  lado: number;
  /** Sin una jugada dibujándose: solo ahí se compara (durante la animación el modelo va un paso adelante). */
  enReposo: boolean;
}

/**
 * Solo depuración (`DEPURACION_DULCES` o `__DEV__`): sobre cada celda, lo que dice el MODELO («c2#17» = color 2,
 * pieza 17). En ámbar, la celda donde lo que se ve no es lo que dice el modelo (hueco, pieza de más, otro color u
 * otro id). No recibe toques.
 */
export function CapaDepuracion({ celdas, ids, piezas, cols, rows, paso, lado, enReposo }: Props) {
  const vistas = new Map<number, PiezaVista>();
  for (const p of piezas) vistas.set(p.fila * cols + p.col, p);
  const total = cols * rows;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: total }, (_, i) => {
        const vista = vistas.get(i);
        const mal = enReposo && (!vista || vista.color !== celdas[i] || vista.id !== ids[i]);
        return (
          <View
            key={i}
            style={[styles.celda, { left: (i % cols) * paso, top: Math.floor(i / cols) * paso, width: lado, height: lado }, mal && styles.mal]}
          >
            <Text style={styles.texto}>{`c${String(celdas[i])}#${String(ids[i])}`}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  celda: { position: 'absolute', justifyContent: 'flex-end', alignItems: 'flex-start' },
  // Ámbar, no rojo (el fallo en Wero nunca es rojo); el texto va sobre la tinta del fondo para leerse sobre cualquier pieza.
  mal: { borderWidth: 2, borderColor: color.wrong, backgroundColor: color.wrongSoft },
  texto: { fontSize: font.size.xs, color: color.text, backgroundColor: color.bg },
});
