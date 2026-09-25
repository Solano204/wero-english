import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from '@/components/base/Icon';
import { Presionable } from '@/components/base/Presionable';
import { color, font, motionDuration, motionEasing, radius, shadow, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { ParFicha } from '@/types';
import type { Rect } from './geometria';

/** Cuánto sube la primera ficha elegida. */
const ELEVACION = 4;

interface Props {
  ficha: ParFicha;
  recta: Rect;
  /** Es la primera ficha de la jugada: sube, gana sombra y borde `accent`. */
  elevada: boolean;
  /** Esta ficha fue parte de una jugada fallida: ámbar y ícono, nunca rojo. */
  falla: boolean;
  /** Además de fallar, es la segunda: la que hace la sacudida estándar. */
  sacude: boolean;
  onPress: () => void;
}

/**
 * Una ficha del tablero. Inglés y español no se parecen: el inglés es la ficha más clara,
 * con filo de luz y titular en Bricolage; el español es la ficha de fondo, sin filo y en
 * Instrument Sans. Cada una lleva su idioma escrito (`EN` / `ES`) y lo anuncia el lector
 * de pantalla, así el par no depende solo de la forma ni del color.
 */
export function FichaPar({ ficha, recta, elevada, falla, sacude, onPress }: Props) {
  const reducido = useMovimientoReducido();
  const alzada = useSharedValue(elevada ? 1 : 0);
  const esEn = ficha.lado === 'en';

  useEffect(() => {
    const meta = elevada ? 1 : 0;
    alzada.value = reducido ? meta : withTiming(meta, { duration: motionDuration.rapido, easing: motionEasing.entrar });
  }, [elevada, reducido, alzada]);

  const alzar = useAnimatedStyle(() => ({ transform: [{ translateY: -ELEVACION * alzada.value }] }));
  const luz = useAnimatedStyle(() => ({ opacity: alzada.value }));

  return (
    <Animated.View
      style={[
        styles.lugar,
        { left: recta.x, top: recta.y, width: recta.width, height: recta.height, zIndex: elevada ? 1 : 0 },
        alzar,
      ]}
    >
      <Animated.View pointerEvents="none" style={[styles.sombra, luz]} />
      <Presionable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${esEn ? 'Inglés' : 'Español'}: ${ficha.texto}`}
        accessibilityLanguage={esEn ? 'en-US' : 'es-MX'}
        accessibilityState={{ selected: elevada }}
        resultado={sacude ? 'fallo' : null}
        style={[styles.ficha, esEn ? styles.fichaEn : styles.fichaEs, falla && styles.fichaFalla]}
      >
        <Text style={styles.idioma}>{esEn ? 'EN' : 'ES'}</Text>
        {falla ? (
          <View style={styles.icono} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name="close" size="sm" color={color.wrong} />
          </View>
        ) : null}
        <Text
          style={[styles.texto, esEn ? styles.textoEn : styles.textoEs]}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {ficha.texto}
        </Text>
      </Presionable>
      <Animated.View pointerEvents="none" style={[styles.anillo, luz]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lugar: { position: 'absolute' },
  sombra: { ...StyleSheet.absoluteFill, borderRadius: radius.md, backgroundColor: color.surfaceAlt, ...shadow.card },
  anillo: { ...StyleSheet.absoluteFill, borderRadius: radius.md, borderWidth: 2, borderColor: color.accent },
  ficha: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingTop: space.lg,
    paddingBottom: space.xs,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fichaEn: { backgroundColor: color.surfaceAlt, borderColor: color.filo },
  fichaEs: { backgroundColor: color.surface, borderColor: 'transparent' },
  fichaFalla: { backgroundColor: color.wrongSoft, borderColor: color.wrong },
  idioma: {
    position: 'absolute',
    top: space.xs,
    left: space.sm,
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.xs,
    color: color.textMuted,
  },
  icono: { position: 'absolute', top: space.xs, right: space.xs },
  texto: { color: color.text, fontSize: font.size.md, textAlign: 'center' },
  textoEn: { fontFamily: font.family.heading },
  textoEs: { fontFamily: font.family.body },
});
