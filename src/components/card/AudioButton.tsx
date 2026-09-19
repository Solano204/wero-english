import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { color, font, motionSpring, radius, space } from '@/theme';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import * as media from '@/services/media';
import { isBundled } from '@/assets/bundled';
import { useMovimientoReducido } from '@/utils';

interface Props {
  path: string | null;
  size?: 'sm' | 'md' | 'lg';
  slow?: boolean;
  label?: string;
  /** Corre justo antes de pedir el audio, sin detener nada por su cuenta. */
  onBeforePlay?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Empaquetado o ya descargado a disco: lo mismo que acepta media.resolve(). */
export function hayAudio(path: string | null): boolean {
  if (!path) return false;
  if (isBundled(path)) return true;
  try {
    return media.fileFor(path).exists;
  } catch {
    return false;
  }
}

/**
 * Botón de audio. Si el archivo no existe se pinta apagado en vez de
 * desaparecer: así el usuario sabe que la frase tiene audio pendiente
 * de descargar, en vez de creer que no lo tiene.
 */
export function AudioButton({ path, size = 'md', slow = false, label, onBeforePlay }: Props) {
  const [missing, setMissing] = useState(false);
  // Sin memo a propósito: un pack que se descarga con la pantalla abierta
  // tiene que reactivar el botón en el siguiente render.
  const sinAudio = !hayAudio(path);
  const apagado = missing || sinAudio;
  const pulse = useSharedValue(1);
  const reducido = useMovimientoReducido();

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const onPress = useCallback(async () => {
    onBeforePlay?.();
    haptics.tapLight();
    if (!reducido) {
      pulse.value = withSequence(
        withSpring(1.12, motionSpring.conRebote),
        withSpring(1, motionSpring.suave)
      );
    }
    const ok = slow ? await audio.playSlow(path) : await audio.play(path);
    if (!ok) setMissing(true);
  }, [path, pulse, slow, reducido, onBeforePlay]);

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={sinAudio}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label ?? (slow ? 'Escuchar lento' : 'Escuchar')}
      accessibilityState={sinAudio ? { disabled: true } : undefined}
      accessibilityHint={
        apagado
          ? 'El audio de esta frase todavía no está disponible'
          : 'Reproduce el audio de la frase'
      }
      style={[
        styles.btn,
        sizes[size],
        apagado && styles.missing,
        sinAudio && styles.sinAudio,
        style,
      ]}
    >
      <Text style={[styles.icon, apagado && styles.iconMissing]}>
        {slow ? '𝄽' : '►'}
      </Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </AnimatedPressable>
  );
}

const sizes = {
  sm: { minHeight: 34, paddingHorizontal: space.sm },
  md: { minHeight: 44, paddingHorizontal: space.md },
  lg: { minHeight: 56, paddingHorizontal: space.lg },
} as const;

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: color.accentSoft,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  missing: { backgroundColor: color.surfaceHigh },
  sinAudio: { opacity: 0.4 },
  icon: { color: color.accent, fontSize: font.size.md, marginTop: -1 },
  iconMissing: { color: color.textFaint },
  label: {
    color: color.accent,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
});
