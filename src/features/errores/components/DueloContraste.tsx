import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon, Presionable } from '@/shared/ui';
import { hayAudio } from '@/shared/ui/AudioButton';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import * as audio from '@/services/audio';
import { color, font, motionDuration, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { ErrorCard } from '@/types';

interface MitadProps {
  tono: 'mal' | 'bien';
  titulo: string;
  texto: string;
  /** El IPA de lo que se dice, si lo hay. */
  ipa?: string | null;
  ruta: string;
}

/** Una mitad del duelo: tocarla suena y la enciende con un velo de su color (ámbar el que suena mal, verde el que suena bien). */
function Mitad({ tono, titulo, texto, ipa, ruta }: MitadProps) {
  const reducido = useMovimientoReducido();
  const voz = useVozEnVivo(ruta);
  const luz = useSharedValue(0);
  const sinAudio = !hayAudio(ruta);
  const tinte = tono === 'mal' ? color.wrong : color.correct;

  useEffect(() => {
    const destino = voz.sonando ? 1 : 0;
    luz.set(reducido ? destino : withTiming(destino, { duration: motionDuration.base, easing: motionEasing.entrar }));
    return () => cancelAnimation(luz);
  }, [voz.sonando, reducido, luz]);
  const estiloLuz = useAnimatedStyle(() => ({ opacity: luz.get() }));

  return (
    <Presionable
      onPress={() => {
        void audio.play(ruta);
      }}
      disabled={sinAudio}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}: ${texto}`}
      accessibilityHint="Escuchar"
      accessibilityState={{ disabled: sinAudio, selected: voz.sonando }}
      style={[styles.mitad, { borderColor: tinte }, sinAudio && styles.sinAudio]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tono === 'mal' ? color.wrongSoft : color.correctSoft }, estiloLuz]}
      />
      <View style={styles.encabezado}>
        <Icon name={tono === 'mal' ? 'signal-broken' : 'check'} size="sm" color={tinte} />
        <Text style={[styles.titulo, { color: tinte }]}>{titulo}</Text>
      </View>
      <Text style={styles.palabra}>{texto}</Text>
      {ipa ? <Text style={styles.ipa}>{ipa}</Text> : null}
      <View style={styles.escuchar}>
        <Icon name="volume" size="sm" color={color.textMuted} />
        <Text style={styles.escucharEtiqueta}>Escuchar</Text>
      </View>
    </Presionable>
  );
}

interface Props {
  error: ErrorCard;
}

/**
 * El duelo de un error de pronunciación, como el de Sonidos: «Así suena mal» en ámbar (lo que dices, con su IPA) contra
 * «Así suena bien» en `correct` (lo correcto), cada uno con su audio. Solo sale si el error trae audio de contraste.
 * El color no es lo único que los distingue: cada mitad lleva su título y su ícono.
 */
export function DueloContraste({ error: e }: Props) {
  if (!e.audio_contraste_archivo) return null;
  return (
    <View style={styles.fila}>
      <Mitad tono="mal" titulo="Así suena mal" texto={e.audio_contraste ?? e.lo_que_dices} ruta={e.audio_contraste_archivo} />
      <Mitad tono="bien" titulo="Así suena bien" texto={e.lo_correcto} ipa={e.ipa_correcto} ruta={e.audio} />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  mitad: {
    flex: 1,
    minHeight: 48,
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  sinAudio: { opacity: 0.4 },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  titulo: { flexShrink: 1, fontFamily: font.family.bodyStrong, fontSize: font.size.sm },
  palabra: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, lineHeight: font.size.md * 1.4, color: color.text },
  ipa: { fontFamily: font.family.ipa, fontSize: font.size.sm, color: color.textMuted },
  escuchar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  escucharEtiqueta: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted },
});
