import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Presionable } from '@/shared/ui';
import { PASOS_PERFIL, indicePaso, puedeSaltarA, textoProgreso, type PasoPerfil } from '@/domain/perfilInicial';
import { color, font, layout, radius, space } from '@/theme';

/** Alto de la barra de cada segmento. */
const ALTO_SEGMENTO = 4;

function etiquetaSegmento(paso: PasoPerfil): string {
  return paso === 'resumen' ? 'Ir al resumen' : `Ir a la ${textoProgreso(paso).toLowerCase()}`;
}

/**
 * «Pregunta 2 de 2» y un segmento por paso. Los segmentos de los pasos que ya se alcanzaron se pueden tocar
 * para saltar directo; el actual y los que todavía no se alcanzan no responden.
 */
export function ProgresoPerfil({
  paso,
  alcanzado,
  onIr,
}: {
  paso: PasoPerfil;
  alcanzado: number;
  onIr: (destino: PasoPerfil) => void;
}) {
  const actual = indicePaso(paso);
  return (
    <View style={styles.raiz}>
      <Text style={styles.texto}>{textoProgreso(paso)}</Text>
      <View style={styles.segmentos}>
        {PASOS_PERFIL.map((p, i) => {
          const saltable = i !== actual && puedeSaltarA(alcanzado, p);
          return (
            <Presionable
              key={p}
              onPress={() => onIr(p)}
              disabled={!saltable}
              accessibilityRole="button"
              accessibilityLabel={etiquetaSegmento(p)}
              accessibilityState={{ disabled: !saltable, selected: i === actual }}
              style={styles.toque}
            >
              <View style={[styles.segmento, i <= actual ? styles.lleno : saltable ? styles.alcanzado : null]} />
            </Presionable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  texto: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.textMuted },
  segmentos: { flexDirection: 'row', gap: space.xs },
  // El área táctil mide lo que el resto de la app; la barra se ve fina en el centro.
  toque: { flex: 1, minHeight: layout.tapMin, justifyContent: 'center' },
  segmento: { height: ALTO_SEGMENTO, borderRadius: radius.pill, backgroundColor: color.border },
  lleno: { backgroundColor: color.accent },
  alcanzado: { backgroundColor: color.borderStrong },
});
