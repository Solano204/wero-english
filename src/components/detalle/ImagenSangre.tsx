import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { hayImagen } from '@/components/card/SceneImage';
import { imageSource } from '@/services/media';
import { color, motionDuration, motionEasing, radius } from '@/theme';
import { useMovimientoReducido } from '@/utils';

/** Alto de la imagen respecto del ancho de la pantalla. */
const RAZON_ALTO = 0.66;
/** La imagen se desplaza a esta fracción del scroll: se queda atrás y da profundidad. */
const PARALAJE = 0.3;
/** Al entrar la imagen se aleja un poco, de 1.06 a 1. */
const ZOOM_INICIAL = 1.06;

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface Props {
  path: string | null;
  /** Desplazamiento de la pantalla (el `scrollY` de `Screen`). */
  scrollY: SharedValue<number>;
  /** La imagen no cargó: quien la usa reacomoda la pantalla como si no hubiera. */
  alFallar?: () => void;
}

/**
 * La imagen de la frase, a sangre arriba: todo el ancho, redondeada solo abajo.
 * Con el scroll se queda atrás (parallax de 0.3) y al entrar se aleja de 1.06 a 1
 * en `escena`. Sin archivo no dibuja nada y no reserva lugar; con reducir
 * movimiento no hay parallax ni zoom. Decorativa: el lector de pantalla no la ve.
 */
export function ImagenSangre({ path, scrollY, alFallar }: Props) {
  const reducido = useMovimientoReducido();
  const { width } = useWindowDimensions();
  const [fallo, setFallo] = useState(false);
  const escala = useSharedValue(reducido ? 1 : ZOOM_INICIAL);

  useEffect(() => {
    escala.value = reducido ? 1 : withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar });
  }, [reducido, escala]);

  const alto = Math.round(width * RAZON_ALTO);
  // La imagen es un 30 % más alta que su marco y arranca subida: al desplazarla hacia abajo
  // con el scroll nunca deja un hueco arriba.
  const holgura = Math.round(alto * PARALAJE);

  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateY: reducido ? 0 : Math.min(Math.max(scrollY.value, 0), alto) * PARALAJE },
      { scale: escala.value },
    ],
  }));

  const source = imageSource(path);
  if (!source || fallo || !hayImagen(path)) return null;

  return (
    <View style={[styles.marco, { height: alto }]} accessible={false} importantForAccessibility="no-hide-descendants">
      <AnimatedImage
        source={source}
        resizeMode="cover"
        onError={() => {
          setFallo(true);
          alFallar?.();
        }}
        style={[styles.imagen, { top: -holgura, height: alto + holgura }, anim]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  marco: {
    overflow: 'hidden',
    backgroundColor: color.surfaceAlt,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  imagen: { position: 'absolute', left: 0, right: 0 },
});
