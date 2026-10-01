import React, { memo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge, Presionable } from '@/shared/ui';
import type { Rect } from '@/shared/ui/fx/useDesfaseVentana';
import { color, font, layout, radius, space, text } from '@/theme';
import { conteo } from '@/domain/texto';
import { useTemporizador } from '@/shared/hooks/useTemporizador';

/** Cuánto se espera la medida del verbo antes de abrir la página sin vuelo (ms). */
const MEDIDA_MAX_MS = 250;
/** Lo que se funde con la tarjeta al final de la fila de chips. */
const ANCHO_FUNDIDO = space.xl + space.sm;

export interface FormaRenglon {
  id: number;
  etiqueta: string;
}

interface Props {
  verbo: string;
  formas: FormaRenglon[];
  /** Las formas que coinciden con la búsqueda: sus chips van en `accent`. Vacío si no hay búsqueda. */
  coinciden: readonly number[];
  /** Con el lugar del verbo en la ventana, para que la página lo haga viajar hasta su título. */
  onAbrir: (verbo: string, origen: Rect | null) => void;
}

/**
 * Un verbo de la lista: su nombre en `h2`, «14 formas» en un `Badge` y, debajo, sus partículas como chips pequeños en
 * una sola fila que se funde al final con la tarjeta (nunca un «…» a media palabra). Todo el renglón se toca; al
 * tocarlo mide dónde está el verbo en la ventana para que la página lo haga viajar.
 */
export const RenglonVerbo = memo(function RenglonVerbo({ verbo, formas, coinciden, onAbrir }: Props) {
  const verboRef = useRef<Text>(null);
  const tiempo = useTemporizador();

  const abrir = () => {
    let enviado = false;
    const ir = (origen: Rect | null) => {
      if (enviado) return;
      enviado = true;
      onAbrir(verbo, origen);
    };
    if (!verboRef.current) {
      ir(null);
      return;
    }
    verboRef.current.measureInWindow((x, y, width, height) => ir({ x, y, width, height }));
    tiempo.despues(() => ir(null), MEDIDA_MAX_MS);
  };

  return (
    <Presionable
      onPress={abrir}
      accessibilityRole="button"
      accessibilityLabel={`${verbo}, ${conteo(formas.length, 'forma')}: ${formas.map((f) => f.etiqueta).join(', ')}`}
      style={styles.fila}
    >
      <View style={styles.cabeza}>
        <Text ref={verboRef} style={[text.h2, styles.verbo]}>
          {verbo}
        </Text>
        <Badge label={conteo(formas.length, 'forma')} small />
      </View>
      <View style={styles.previa}>
        <View style={styles.chips}>
          {formas.map((f) => {
            const marcada = coinciden.includes(f.id);
            return (
              <View key={f.id} style={[styles.chip, marcada && styles.chipMarcado]}>
                <Text style={[styles.etiqueta, marcada && styles.etiquetaMarcada]}>{f.etiqueta}</Text>
              </View>
            );
          })}
        </View>
        <LinearGradient
          colors={[color.surfaceSinAlfa, color.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fundido}
          pointerEvents="none"
        />
      </View>
    </Presionable>
  );
});

const styles = StyleSheet.create({
  fila: {
    minHeight: layout.tapMin,
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  // Un verbo largo cede ante la insignia «N formas» en vez de empujarla fuera de la tarjeta.
  verbo: { flexShrink: 1 },
  previa: { overflow: 'hidden' },
  chips: { flexDirection: 'row', gap: space.xs },
  chip: {
    flexShrink: 0,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
  },
  chipMarcado: { backgroundColor: color.accentSoft },
  etiqueta: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted },
  etiquetaMarcada: { fontFamily: font.family.bodyStrong, color: color.accent },
  fundido: { position: 'absolute', top: 0, bottom: 0, right: 0, width: ANCHO_FUNDIDO },
});
