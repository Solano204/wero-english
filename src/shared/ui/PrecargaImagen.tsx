import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { CACHE_IMAGEN, hayArchivo, imageSource } from '@/services/media';

interface Props {
  /** La imagen que viene después (ruta relativa del catálogo), o null. */
  path: string | null;
  /** El mismo ancho y alto con que se va a mostrar: la caché de memoria guarda la imagen ya escalada a ese tamaño. */
  ancho: number;
  alto: number;
}

/**
 * Decodifica por adelantado la imagen que sigue, sin que se vea.
 *
 * `Image.prefetch` de expo-image en Android solo baja URLs http y las imágenes de la app son archivos locales (del APK o
 * descargados), así que ahí no hace nada. Esto monta una imagen invisible del mismo tamaño y con la misma caché que el
 * `MarcoImagen` que la va a mostrar: cuando llega su turno ya está en memoria y no hay decodificación en ese cuadro.
 */
export function PrecargaImagen({ path, ancho, alto }: Props) {
  if (!path || !hayArchivo(path)) return null;
  const source = imageSource(path);
  if (!source) return null;
  return (
    <Image
      source={source}
      contentFit="cover"
      cachePolicy={CACHE_IMAGEN}
      style={[styles.oculta, { width: ancho, height: alto }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  oculta: { position: 'absolute', top: 0, left: 0, opacity: 0 },
});
