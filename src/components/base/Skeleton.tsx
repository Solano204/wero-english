import React from 'react';
import { StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { Hueso, ProveedorEsqueleto } from '@/components/esqueleto';
import { radius, space } from '@/theme';

interface BloqueProps {
  height?: number;
  width?: DimensionValue;
  /** Cubre a su contenedor (posición absoluta) en vez de tomar un alto propio. */
  relleno?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bloque con el brillo del esqueleto (ver `@/components/esqueleto`). Necesita
 * un `ProveedorEsqueleto` arriba para brillar; `SkeletonLista` ya trae el
 * suyo. Se conserva este nombre porque `ConsolaHoy` y otras pantallas ya lo
 * usan suelto, superpuesto a su propio contenido.
 */
export function Skeleton({ height = 16, width = '100%', relleno = false, style }: BloqueProps) {
  return (
    <Hueso
      height={relleno ? undefined : height}
      width={relleno ? undefined : width}
      style={[relleno ? StyleSheet.absoluteFill : null, style]}
    />
  );
}

interface ListaProps {
  filas?: number;
  alto?: number;
}

/** Esqueleto genérico de lista: N filas de tarjeta, con su propio proveedor de brillo. */
export function SkeletonLista({ filas = 5, alto = 72 }: ListaProps) {
  return (
    <ProveedorEsqueleto style={styles.lista}>
      {Array.from({ length: filas }, (_, i) => (
        <Hueso key={i} height={alto} radius={radius.md} style={styles.fila} />
      ))}
    </ProveedorEsqueleto>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: space.md,
  },
  fila: {},
});
