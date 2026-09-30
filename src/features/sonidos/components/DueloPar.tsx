import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Button } from '@/shared/ui/Button';
import { Presionable } from '@/shared/ui/Presionable';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import * as audio from '@/services/audio';
import { color, font, motionDuration, motionEasing, motionPulso, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { ParMinimo } from '@/types';

/** Pausa entre las dos palabras de «Escuchar las dos». */
const PAUSA_ENTRE_MS = 300;
/** El «≠» crece más que un acierto: es el centro del duelo. */
const PULSO_DIFERENTE = motionPulso.escala + 0.3;

interface MitadProps {
  palabra: string;
  ipa: string;
  es: string;
  sonando: boolean;
  onPress: () => void;
}

/** Una mitad del duelo: tocarla suena y la enciende con un filo de `accent`. */
function Mitad({ palabra, ipa, es, sonando, onPress }: MitadProps) {
  const reducido = useMovimientoReducido();
  const luz = useSharedValue(0);
  useEffect(() => {
    const destino = sonando ? 1 : 0;
    luz.set(reducido ? destino : withTiming(destino, { duration: motionDuration.base, easing: motionEasing.entrar }));
  }, [sonando, reducido, luz]);
  const estilo = useAnimatedStyle(() => ({ opacity: luz.get() }));

  return (
    <Presionable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${palabra}. ${es}`}
      accessibilityHint="Escuchar la palabra"
      style={styles.mitad}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.luz, estilo]} pointerEvents="none" />
      <Text style={styles.palabra}>{palabra}</Text>
      <Text style={styles.ipa}>{ipa}</Text>
      <Text style={styles.es}>{es}</Text>
    </Presionable>
  );
}

interface Props {
  par: ParMinimo;
  /** Es la página que se ve: las vecinas no escuchan la voz. */
  esActual: boolean;
}

/**
 * Un par que cambia de significado, como un duelo: dos mitades con su palabra, su IPA y su traducción. Al tocar una
 * suena y se enciende, y el «≠» del centro hace un pulso. «Escuchar las dos» las reproduce seguidas y enciende cada
 * mitad en su turno. Con «reducir movimiento» no hay pulso: solo se enciende la mitad que suena.
 */
export function DueloPar({ par, esActual }: Props) {
  const reducido = useMovimientoReducido();
  const vozA = useVozEnVivo(esActual ? par.audio_a : null);
  const vozB = useVozEnVivo(esActual ? par.audio_b : null);
  const pulso = useSharedValue(1);
  // Cada toque o cada «Escuchar las dos» sube el ciclo: una secuencia en curso deja de ser la vigente.
  const ciclo = useRef(0);

  const suenaAlguna = vozA.sonando || vozB.sonando;
  useEffect(() => {
    if (!suenaAlguna || reducido) return;
    pulso.set(withSequence(
      withTiming(PULSO_DIFERENTE, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.salir })
    ));
  }, [suenaAlguna, reducido, pulso]);
  const estiloDiferente = useAnimatedStyle(() => ({ transform: [{ scale: pulso.get() }] }));

  useEffect(
    () => () => {
      ciclo.current++;
    },
    []
  );

  const oir = (path: string) => {
    ciclo.current++;
    void audio.play(path);
  };

  const oirLasDos = () => {
    const mio = ++ciclo.current;
    void audio.playSequence(
      [
        { path: par.audio_a, pauseMs: PAUSA_ENTRE_MS },
        { path: par.audio_b, pauseMs: 0 },
      ],
      () => ciclo.current === mio
    );
  };

  return (
    <View style={styles.tarjeta}>
      <View style={styles.duelo}>
        <Mitad palabra={par.a} ipa={par.a_ipa} es={par.a_es} sonando={vozA.sonando} onPress={() => oir(par.audio_a)} />
        <Animated.Text
          style={[styles.diferente, estiloDiferente]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          ≠
        </Animated.Text>
        <Mitad palabra={par.b} ipa={par.b_ipa} es={par.b_es} sonando={vozB.sonando} onPress={() => oir(par.audio_b)} />
      </View>
      <Button label="Escuchar las dos" icon="volume" variant="ghost" onPress={oirLasDos} />
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.surfaceAlt },
  duelo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mitad: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    padding: space.md,
    minHeight: 96,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
  },
  luz: { borderRadius: radius.md, borderWidth: 1.5, borderColor: color.accent, backgroundColor: color.accentSoft },
  palabra: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text, textAlign: 'center' },
  // Charis SIL solo trae Regular: se compensa con tamaño, no con peso.
  ipa: { fontFamily: font.family.ipa, fontSize: font.size.sm, color: color.textMuted },
  es: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint, textAlign: 'center' },
  diferente: { fontFamily: font.family.body, fontSize: font.size.xl, color: color.textFaint },
});
