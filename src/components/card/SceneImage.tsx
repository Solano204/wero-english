import React, { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { isBundled } from '@/assets/bundled';
import * as media from '@/services/media';
import { imageSource } from '@/services/media';
import { color, radius, aparecer } from '@/theme';

interface Props {
  path: string | null;
  size?: number;
  round?: boolean;
  style?: ViewStyle;
  /**
   * Ocupa todo el ancho disponible. `size` pasa a ser solo el alto.
   * Una imagen cuadrada centrada dentro de una tarjeta ancha deja dos
   * columnas de aire a los lados y se lee como un error de maquetación.
   */
  ancha?: boolean;
}

/** ¿Hay archivo de esta imagen (empaquetado o ya descargado)? Sin él no se dibuja ni se reserva lugar. */
export function hayImagen(path: string | null): boolean {
  if (!path) return false;
  if (isBundled(path)) return true;
  try {
    return media.fileFor(path).exists;
  } catch {
    return false;
  }
}

/**
 * Imagen de escena.
 *
 * Si el archivo no está no dibuja nada y no reserva espacio: ni un marco con
 * las iniciales de la frase ni un hueco vacío. Quien la usa decide cómo se ve
 * la pantalla sin ella (`hayImagen` lo dice antes de armar el diseño).
 */
export function SceneImage({ path, size = 200, round = true, style, ancha }: Props) {
  const [failed, setFailed] = useState(false);
  const source = imageSource(path);

  if (!source || failed || !hayImagen(path)) return null;

  const box = {
    width: (ancha ? '100%' : size) as number | '100%',
    height: size,
    borderRadius: round ? radius.lg : 0,
  } as const;

  return (
    // La animación de entrada va en una vista y no en la imagen: el Image de expo-image
    // envuelto con createAnimatedComponent lleva sus callbacks (onError) al hilo de UI y
    // revienta con "Tried to synchronously call a Remote Function".
    <Animated.View
      entering={aparecer()}
      style={[styles.image, box, ancha ? { alignSelf: 'stretch' } : { alignSelf: 'center' }, style]}
    >
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        onError={() => setFailed(true)}
        contentFit="cover"
        accessible={false}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: color.surfaceAlt, overflow: 'hidden' },
});
