import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Presionable } from '@/components/base';
import * as haptics from '@/services/haptics';
import { color, font, layout, radius, space } from '@/theme';

interface Props {
  verbo: string;
  /** El nombre de cada partícula del verbo, en orden (las repetidas ya van numeradas). */
  etiquetas: readonly string[];
  /** La forma elegida: su chip va encendido. */
  indice: number;
  onElegir: (indice: number) => void;
}

/**
 * Todas las formas del verbo como chips, con la actual encendida en `accent`: acceso rápido a cualquiera sin girar la
 * ruleta y, con «reducir movimiento», el control principal (ahí no hay ruleta). Cada chip mide 48 dp de alto y cabe
 * en varias filas. Para el lector de pantalla es un grupo de opciones con una elegida.
 */
export function ChipsFormas({ verbo, etiquetas, indice, onElegir }: Props) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={`Formas de ${verbo}`} style={styles.bloque}>
      <Text style={styles.titulo}>{`Todas las formas de ${verbo}`}</Text>
      <View style={styles.chips}>
        {etiquetas.map((etiqueta, i) => {
          const elegida = i === indice;
          return (
            <Presionable
              key={i}
              onPress={() => {
                if (elegida) return;
                haptics.selection();
                onElegir(i);
              }}
              accessibilityRole="radio"
              accessibilityLabel={etiqueta}
              accessibilityState={{ checked: elegida }}
              style={[styles.chip, elegida && styles.chipElegido]}
            >
              <Text style={[styles.etiqueta, elegida && styles.etiquetaElegida]}>{etiqueta}</Text>
            </Presionable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: space.sm },
  titulo: {
    fontSize: font.size.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: font.family.bodyStrong,
    color: color.textFaint,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: layout.tapMin,
    minWidth: layout.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipElegido: { backgroundColor: color.accentSoft, borderColor: color.accent },
  etiqueta: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  etiquetaElegida: { fontFamily: font.family.bodyStrong, color: color.accent },
});
