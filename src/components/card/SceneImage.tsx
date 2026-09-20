import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  type ImageStyle,
  type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { imageSource } from '@/services/media';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native';
import { color, filoLuz, font, gradiente, radius, sol, aparecer } from '@/theme';

/** Par del marcador. Mismo gris que `gradiente.neutro`.
 *  `gradiente` es un Record y TS lo da como posiblemente indefinido al
 *  indexarlo (`noUncheckedIndexedAccess`); la clave existe siempre. */
const MARCADOR: readonly [string, string] = gradiente.neutro as [string, string];

interface Props {
  path: string | null;
  size?: number;
  round?: boolean;
  style?: ViewStyle;
  /**
   * Texto del que sale la inicial del marcador. Normalmente la frase.
   * Sin esto el hueco se ve vacío; con esto se ve pendiente.
   */
  etiqueta?: string;
  /**
   * Ocupa todo el ancho disponible. `size` pasa a ser solo el alto.
   * Una imagen cuadrada centrada dentro de una tarjeta ancha deja dos
   * columnas de aire a los lados y se lee como un error de maquetación.
   */
  ancha?: boolean;
}

/** Dos letras a partir de un texto: 'Turn into these' -> 'TI'. */
function iniciales(txt: string): string {
  const partes = txt.trim().split(/\s+/).filter(Boolean);
  const a = partes[0];
  if (!a) return '·';
  const b = partes[1];
  if (!b) return a.slice(0, 2).toUpperCase();
  return (a[0]! + b[0]!).toUpperCase();
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

/**
 * Imagen de escena.
 *
 * Si el archivo no está, deja un hueco del mismo tamaño en vez de
 * colapsar. Colapsar hace que la tarjeta salte de altura entre una
 * frase con imagen y otra sin ella, y ese salto se nota mucho más que
 * un rectángulo vacío.
 *
 * Con 1,416 imágenes en el catálogo, la mitad van a faltar mientras las
 * generas. Esta pantalla tiene que verse bien en ese estado intermedio.
 */
export function SceneImage({ path, size = 200, round = true, style, etiqueta, ancha }: Props) {
  const [failed, setFailed] = useState(false);
  const source = imageSource(path);

  const box = {
    width: (ancha ? '100%' : size) as number | '100%',
    height: size,
    borderRadius: round ? radius.lg : 0,
  } as const;

  if (!source || failed) {
    return (
      <LinearGradient
        colors={filoLuz}
        start={sol.start}
        end={sol.end}
        style={[
          { borderRadius: box.borderRadius, padding: 1 },
          // Ancha se estira de borde a borde; estrecha se centra. Sin
          // esto quedaba pegada a la izquierda dentro de una tarjeta
          // ancha, y se leia como un error de maquetacion.
          ancha ? { alignSelf: 'stretch' } : { alignSelf: 'center' },
          style,
        ]}
      >
        <LinearGradient
          colors={MARCADOR}
          start={sol.start}
          end={sol.end}
          style={[
            styles.marcador,
            {
              width: ancha ? '100%' : (size - 2),
              height: size - 2,
              borderRadius: Math.max(0, box.borderRadius - 1),
            },
          ]}
        >
          <Text style={styles.inicial}>{iniciales(etiqueta ?? '')}</Text>
        </LinearGradient>
      </LinearGradient>
    );
  }

  return (
    <AnimatedImage
      entering={aparecer()}
      source={source}
      style={[
        styles.image,
        box as ImageStyle,
        (ancha ? { alignSelf: 'stretch' } : { alignSelf: 'center' }) as ImageStyle,
        style as ImageStyle,
      ]}
      onError={() => setFailed(true)}
      resizeMode="cover"
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: color.surfaceAlt },
  marcador: { alignItems: 'center', justifyContent: 'center' },
  inicial: {
    fontSize: 44,
    fontFamily: font.family.display,
    letterSpacing: 2,
    color: color.textSobrePortada,
  },
});
