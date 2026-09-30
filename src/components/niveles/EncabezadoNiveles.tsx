import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Marcador } from '@/shared/ui/fx/Marcador';
import { BarraFina } from '@/shared/ui/BarraFina';
import { blur, color, font, layout, space, text } from '@/theme';
import { miles } from '@/domain/texto';

/** Scroll (dp) que tarda la banda en llegar a su opacidad completa. */
const RANGO_BANDA = space.xl;

interface Props {
  titulo: string;
  /** Las estrellas que se muestran (el contador rueda cuando cambia); `null` mientras cargan. */
  estrellas: number | null;
  maximo: number;
  scrollY: SharedValue<number>;
  onBack: () => void;
}

/**
 * El encabezado del mapa: el nombre del juego y «36 de 600 estrellas» (la cifra rueda
 * con `Marcador` cuando sube) con una barra fina de progreso total en `star`. Es fijo
 * arriba y la lista empieza debajo, así que ninguna fila queda cortada; al hacer scroll
 * toma la banda de desenfoque (solo iOS; en Android, fondo sólido) con su filete.
 */
export function EncabezadoNiveles({ titulo, estrellas, maximo, scrollY, onBack }: Props) {
  const banda = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, RANGO_BANDA], [0, 1], Extrapolation.CLAMP),
  }));
  const etiqueta = estrellas === null ? undefined : `${miles(estrellas)} de ${miles(maximo)} estrellas`;

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, banda]}>
        {Platform.OS === 'ios' ? (
          <>
            <BlurView intensity={blur.medio} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.velo]} />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.solida]} />
        )}
        <View style={styles.borde} />
      </Animated.View>

      <View style={styles.fila}>
        <IconButton icono="back" etiqueta="Atrás" tamano="sm" onPress={onBack} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={[text.h2, styles.titulo]}>
          {titulo}
        </Text>
      </View>

      {estrellas === null ? null : (
        <View style={styles.progreso}>
          <View style={styles.cuenta} accessible accessibilityRole="text" accessibilityLabel={etiqueta}>
            <Icon name="star-filled" size="sm" color={color.star} />
            <Marcador valor={estrellas} tamano={font.size.md} color={color.star} etiqueta={etiqueta} />
            <Text maxFontSizeMultiplier={1.2} style={styles.de}>
              de {miles(maximo)} estrellas
            </Text>
          </View>
          <BarraFina fraccion={maximo > 0 ? estrellas / maximo : 0} tinte={color.star} activo />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: layout.screenPad, paddingTop: space.xs, paddingBottom: space.md, gap: space.sm },
  velo: { backgroundColor: color.veloBarra },
  solida: { backgroundColor: color.bgAlto },
  borde: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: color.border },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titulo: { flex: 1 },
  progreso: { gap: space.sm, paddingLeft: space.xs },
  cuenta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  de: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
