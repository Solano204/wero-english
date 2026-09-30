import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Hueso, ProveedorEsqueleto } from '@/components/esqueleto';
import { COLUMNAS } from '@/domain/niveles';
import { color, layout, radius, space } from '@/theme';
import { ALTO_TRAMO } from './EncabezadoTramo';
import { HUECO_CELDAS } from './FilaNiveles';

/** Renglones que se ven del tramo abierto antes de que empiece el siguiente. */
const FILAS_ABIERTO = 5;
/** Tramos cerrados debajo del abierto: los tres tramos de un juego. */
const TRAMOS_CERRADOS = 2;

function TramoHueso() {
  return (
    <View style={styles.tramo}>
      <View style={styles.tramoFila}>
        <View style={styles.tramoTextos}>
          <Hueso width="50%" height={18} />
          <Hueso width="35%" height={13} />
        </View>
        <Hueso width={44} height={14} />
      </View>
      <Hueso height={4} radius={2} />
    </View>
  );
}

/**
 * La lista de Niveles mientras carga, con sus medidas de verdad: encabezado de tramo de
 * `ALTO_TRAMO`, renglones de `COLUMNAS` celdas de `lado` con `HUECO_CELDAS` de separación
 * (los mismos números que usa `getItemLayout`) y los otros tramos cerrados debajo. Al
 * llegar los datos la lista cae en el mismo lugar: nada brinca.
 */
export function EsqueletoNiveles({ lado }: { lado: number }) {
  return (
    <ProveedorEsqueleto etiqueta="Cargando los niveles">
      <TramoHueso />
      {Array.from({ length: FILAS_ABIERTO }, (_, f) => (
        <View key={f} style={[styles.fila, { height: lado + HUECO_CELDAS }]}>
          {Array.from({ length: COLUMNAS }, (_, c) => (
            <Hueso key={c} width={lado} height={lado} radius={radius.md} />
          ))}
        </View>
      ))}
      {Array.from({ length: TRAMOS_CERRADOS }, (_, i) => (
        <TramoHueso key={i} />
      ))}
    </ProveedorEsqueleto>
  );
}

const styles = StyleSheet.create({
  // Mismo alto, relleno y línea de abajo que `EncabezadoTramo`.
  tramo: {
    height: ALTO_TRAMO,
    paddingHorizontal: layout.screenPad,
    justifyContent: 'center',
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  tramoFila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tramoTextos: { flex: 1, gap: space.xs },
  // Mismo relleno y hueco que `FilaNiveles`.
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: HUECO_CELDAS, paddingHorizontal: layout.screenPad },
});
