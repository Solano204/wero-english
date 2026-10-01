import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Hueso, HuesoBoton, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { radius, space } from '@/theme';

/** Lo que se ve mientras se arma el tablero de Colmena (solo si la carga tarda). */
export function EsqueletoColmena() {
  return (
    <>
      <ProveedorEsqueleto etiqueta="Armando el tablero" style={styles.esqueletoRaiz}>
        <View style={styles.esqueletoReloj}>
          <Hueso height={4} radius={radius.pill} />
        </View>
        <View style={styles.esqueletoCentro}>
          <Hueso width="70%" height={18} style={styles.esqueletoCentrado} />
          <Hueso width="55%" height={26} style={styles.esqueletoCentrado} />
        </View>
        <View style={styles.esqueletoEscuchar}>
          <HuesoBoton width={150} />
          <Hueso width={88} height={32} />
        </View>
        <View style={styles.esqueletoRanuras}>
          {Array.from({ length: 12 }, (_, i) => (
            <Hueso key={i} width={28} height={36} />
          ))}
        </View>
        <View style={styles.esqueletoPanal}>
          {[6, 5, 6, 5].map((n, fila) => (
            <View key={fila} style={[styles.esqueletoFilaPanal, fila % 2 === 1 && styles.esqueletoFilaCorrida]}>
              {Array.from({ length: n }, (_, i) => (
                <Hueso key={i} width={48} height={48} radius={radius.md} />
              ))}
            </View>
          ))}
        </View>
      </ProveedorEsqueleto>
      <View style={styles.pie}>
        <View style={styles.pieRow}>
          <HuesoBoton />
          <HuesoBoton />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // El footer de Screen ya pone el padding horizontal y el de abajo
  // (con SafeArea incluida): aquí solo el espacio entre la fila de
  // botones y la nota.
  pie: { gap: space.sm },
  // Alto fijo de «Siguiente»: el pie no cambia de tamaño al resolverse la ronda, y el panal no se corre mientras vuela la última ficha.
  pieRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center', minHeight: 58 },
  esqueletoRaiz: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.lg },
  esqueletoReloj: { marginBottom: space.sm },
  esqueletoCentro: { alignItems: 'center', gap: space.sm },
  esqueletoCentrado: { alignSelf: 'center' },
  esqueletoEscuchar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  esqueletoRanuras: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  esqueletoPanal: { gap: space.xs, alignItems: 'center' },
  esqueletoFilaPanal: { flexDirection: 'row', gap: space.xs },
  esqueletoFilaCorrida: { marginLeft: space.xl },
});
