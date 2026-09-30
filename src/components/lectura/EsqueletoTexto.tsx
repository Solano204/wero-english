import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Hueso, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import type { Oracion as OracionTexto } from '@/domain/oraciones';
import { layout } from '@/theme';
import { AIRE_ORACION, AIRE_PARRAFO, RENGLON_LECTURA, TAMANO_LECTURA } from './Oracion';

/** Ancho medio de un carácter del texto de la lectura, como fracción del tamaño de letra. */
const ANCHO_CARACTER = 0.5;
/** Largo del último renglón de cada oración: no se sabe dónde corta, así que se deja a media línea. */
const ULTIMO_RENGLON = '55%';

interface Props {
  /** Las oraciones del capítulo: el esqueleto tiene los mismos párrafos y más o menos los mismos renglones. */
  oraciones: OracionTexto[];
  /** Pasó la demora de carga: se pintan los huesos. Antes, el lugar queda vacío (una carga corta no parpadea). */
  visible: boolean;
}

/**
 * El lugar del texto del capítulo mientras se leen sus frases de la base: oración por oración, con el mismo
 * interlineado, el mismo aire entre oraciones y entre párrafos, y los renglones que ocuparía cada una a este ancho de
 * pantalla. Se quita de golpe (sin fundido): un fundido lo dejaría encimado sobre el texto que ya llegó.
 */
export function EsqueletoTexto({ oraciones, visible }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const renglones = useMemo(() => {
    const porRenglon = Math.max(
      12,
      Math.floor((width - 2 * layout.screenPad) / (TAMANO_LECTURA * fontScale * ANCHO_CARACTER))
    );
    return oraciones.map((o) => Math.max(1, Math.ceil(o.texto.length / porRenglon)));
  }, [oraciones, width, fontScale]);

  if (!visible) return <View accessible={false} />;
  return (
    <ProveedorEsqueleto etiqueta="Cargando la lectura" salida={false}>
      {oraciones.map((o, i) => (
        <View key={i} style={[styles.oracion, i > 0 && o.parrafo !== oraciones[i - 1]?.parrafo && styles.parrafo]}>
          {Array.from({ length: renglones[i] ?? 1 }, (_, r) => (
            <View key={r} style={styles.renglon}>
              <Hueso height={TAMANO_LECTURA} width={r === (renglones[i] ?? 1) - 1 ? ULTIMO_RENGLON : '100%'} />
            </View>
          ))}
        </View>
      ))}
    </ProveedorEsqueleto>
  );
}

const styles = StyleSheet.create({
  oracion: { paddingVertical: AIRE_ORACION },
  parrafo: { marginTop: AIRE_PARRAFO },
  renglon: { height: RENGLON_LECTURA, justifyContent: 'center' },
});
