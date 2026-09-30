import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Presionable } from '@/shared/ui/Presionable';
import { OndaVoz } from '@/shared/ui/fx/OndaVoz';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar } from '@/domain/marcas';
import * as audio from '@/services/audio';
import { marcasDe } from '@/services/marcas';
import { color, font, layout, motionDuration, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { FonemaEjemplo } from '@/types';

const ANCHO_ONDA = 56;
const ALTO_ONDA = 16;

interface Props {
  ejemplo: FonemaEjemplo;
  /** Es la página que se ve: las vecinas no escuchan la voz. */
  esActual: boolean;
}

/**
 * Una palabra de ejemplo: la palabra en `md` semibold, su IPA en Charis SIL debajo y la traducción a la derecha. Todo
 * el renglón (56 dp) es tocable y reproduce el audio, no solo un círculo. Mientras suena, lleva un filo de `accent` y
 * una onda mini. Con «reducir movimiento» el filo y la onda cambian sin fundido.
 */
export function RenglonPalabra({ ejemplo, esActual }: Props) {
  const reducido = useMovimientoReducido();
  const voz = useVozEnVivo(esActual ? ejemplo.audio : null);
  const analisis = useMemo(
    () => analizar(ejemplo.palabra, ejemplo.palabra, marcasDe(ejemplo.audio), voz.duracion),
    [ejemplo.palabra, ejemplo.audio, voz.duracion]
  );

  const suena = voz.sonando;
  const luz = useSharedValue(0);
  useEffect(() => {
    const destino = suena ? 1 : 0;
    luz.set(reducido ? destino : withTiming(destino, { duration: motionDuration.base, easing: motionEasing.entrar }));
  }, [suena, reducido, luz]);
  const estiloFilo = useAnimatedStyle(() => ({ opacity: luz.get() }));

  return (
    <Presionable
      onPress={() => void audio.play(ejemplo.audio)}
      accessibilityRole="button"
      accessibilityLabel={`${ejemplo.palabra}. ${ejemplo.spanish}`}
      accessibilityHint="Escuchar la palabra"
    >
      <View style={styles.fila}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.filo, estiloFilo]} pointerEvents="none" />
        <View style={styles.textos}>
          <Text style={styles.palabra}>{ejemplo.palabra}</Text>
          <Text style={styles.ipa}>{ejemplo.ipa}</Text>
        </View>
        <Animated.View
          style={[styles.onda, estiloFilo]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          pointerEvents="none"
        >
          <OndaVoz voz={voz} envolvente={analisis.envolvente} alto={ALTO_ONDA} />
        </Animated.View>
        <Text style={styles.traduccion}>{ejemplo.spanish}</Text>
      </View>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  fila: {
    minHeight: layout.filaModo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  filo: { borderRadius: radius.md, borderWidth: 1.5, borderColor: color.accent },
  textos: { flex: 1 },
  palabra: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  // Charis SIL solo trae Regular: se compensa con tamaño, no con peso.
  ipa: { fontFamily: font.family.ipa, fontSize: font.size.sm, color: color.textMuted },
  onda: { width: ANCHO_ONDA, height: ALTO_ONDA },
  traduccion: {
    flexShrink: 1,
    maxWidth: '40%',
    textAlign: 'right',
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
  },
});
