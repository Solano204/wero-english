import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Presionable } from '@/components/base/Presionable';
import { estiloResultado, type Resultado } from '@/components/feedback';
import { color, depth, font, motionDuration, motionEasing, radius, shadow, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { ALTO_FICHA } from './medidas';

/** De qué tamaño aparece la ficha. */
const ESCALA_INICIO = 0.96;

interface Props {
  texto: string;
  onPress: () => void;
  resultado: Resultado | null;
}

/**
 * Una ficha de respuesta. Mide `ALTO_FICHA` exacto (96 dp): la caída cuenta con ello para detenerse
 * sobre el piso, así que un texto largo se encoge (hasta 0.8) en vez de hacerla crecer. Al aparecer
 * arriba de la pista entra con un fundido y un destello de señal en el borde; quien la usa le pone
 * `key` de la ronda para que se repita. Con «reducir movimiento» aparece sin destello ni escala.
 */
export function FichaCaida({ texto, onPress, resultado }: Props) {
  const reducido = useMovimientoReducido();
  const entrada = useSharedValue(0);
  const destello = useSharedValue(reducido ? 0 : 1);

  useEffect(() => {
    entrada.value = withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar });
    destello.value = reducido ? 0 : withTiming(0, { duration: motionDuration.lento, easing: motionEasing.salir });
  }, [reducido, entrada, destello]);

  const aparece = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ scale: reducido ? 1 : ESCALA_INICIO + (1 - ESCALA_INICIO) * entrada.value }],
  }));
  const luz = useAnimatedStyle(() => ({ opacity: destello.value }));

  return (
    <Animated.View style={[styles.lugar, aparece]}>
      <Presionable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={texto}
        resultado={resultado}
        style={[styles.ficha, resultado && estiloResultado[resultado]]}
      >
        <Text style={styles.texto} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}>
          {texto}
        </Text>
        <Animated.View pointerEvents="none" style={[styles.destello, luz]} />
      </Presionable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lugar: { flex: 1 },
  ficha: {
    height: ALTO_FICHA,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderBottomWidth: depth.sm,
    borderBottomColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
    ...shadow.card,
  },
  texto: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    textAlign: 'center',
  },
  // El destello de señal al aparecer: un borde `accent` que se apaga.
  destello: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.accent,
  },
});
