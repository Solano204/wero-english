import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, layout, radius, space } from '@/theme';
import { Icon } from '@/shared/ui/Icon';
import { Presionable } from '@/shared/ui/Presionable';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import * as media from '@/services/media';
import { isBundled } from '@/assets/bundled';

interface Props {
  path: string | null;
  size?: 'sm' | 'md' | 'lg';
  slow?: boolean;
  label?: string;
  /** Lo que lee el lector de pantalla cuando el botón no lleva `label` visible («Escuchar el significado»). */
  descripcion?: string;
  /** Corre justo antes de pedir el audio, sin detener nada por su cuenta. */
  onBeforePlay?: () => void;
}

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
export function AudioButton({ path, size = 'md', slow = false, label, descripcion, onBeforePlay }: Props) {
  const [missing, setMissing] = useState(false);
  // Sin memo a propósito: un pack que se descarga con la pantalla abierta
  // tiene que reactivar el botón en el siguiente render.
  const sinAudio = !hayAudio(path);
  const apagado = missing || sinAudio;
  // El reloj de arena solo no dice "lento": en slow el texto siempre se ve.
  const etiqueta = slow ? (label ?? 'Lento') : label;
  const onPress = useCallback(async () => {
    onBeforePlay?.();
    haptics.tapLight();
    const ok = slow ? await audio.playSlow(path) : await audio.play(path);
    if (!ok) setMissing(true);
  }, [path, slow, onBeforePlay]);

  return (
    <Presionable
      onPress={onPress}
      disabled={sinAudio}
      accessibilityRole="button"
      accessibilityLabel={label ?? descripcion ?? (slow ? 'Escuchar lento' : 'Escuchar')}
      accessibilityState={sinAudio ? { disabled: true } : undefined}
      accessibilityHint={
        apagado
          ? 'El audio de esta frase todavía no está disponible'
          : 'Reproduce el audio de la frase'
      }
      style={styles.toque}
    >
      <View
        style={[
          styles.btn,
          sizes[size],
          apagado && styles.missing,
          sinAudio && styles.sinAudio,
        ]}
      >
        <Icon name={slow ? 'slow' : 'play'} size={size} color={apagado ? color.textFaint : color.accent} />
        {etiqueta ? <Text style={styles.label}>{etiqueta}</Text> : null}
      </View>
    </Presionable>
  );
}

/** Tamaño de la píldora que se ve. Lo que se toca es `styles.toque`: 48 dp o más. */
const sizes = {
  sm: { minHeight: 34, paddingHorizontal: space.sm },
  md: { minHeight: 44, paddingHorizontal: space.md },
  lg: { minHeight: 56, paddingHorizontal: space.lg },
} as const;

const styles = StyleSheet.create({
  toque: {
    minWidth: layout.tapMin,
    minHeight: layout.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: color.accentSoft,
    borderRadius: radius.pill,
  },
  missing: { backgroundColor: color.surfaceHigh },
  sinAudio: { opacity: 0.4 },
  label: {
    color: color.accent,
    fontSize: font.size.sm,
    fontFamily: font.family.bodyStrong,
  },
});
