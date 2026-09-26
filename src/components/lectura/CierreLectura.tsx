import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Card, Icon } from '@/components/base';
import { aparecerSubiendo, color, font, motionDuration, motionEasing, space } from '@/theme';
import { conteo, useMovimientoReducido } from '@/utils';

/** Lado del círculo del ícono, en dp. */
const LADO = 72;
/** Cuánto crece el destello antes de apagarse (veces el círculo) y con qué opacidad sale. */
const CRECE = 0.9;
const OPACIDAD = 0.35;

interface Props {
  /** Cuántas frases del catálogo tenía la historia que el usuario aún no tenía. */
  nuevas: number;
  /** Contestó las tres preguntas: un solo destello suave. Sin confeti ni puntaje. */
  todas: boolean;
}

function textoNuevas(n: number): string {
  return n === 0 ? 'Ya conocías todas las frases de esta historia.' : `Tenía ${conteo(n, 'frase nueva', 'frases nuevas')} para ti.`;
}

/**
 * El cierre de una historia: «Terminaste la historia», sin calificación, y cuántas frases nuevas tenía. Si el usuario
 * contestó las tres preguntas, un destello `accent` se abre una sola vez detrás del ícono y se apaga. Con «reducir
 * movimiento» no hay destello ni entrada. El botón para volver a la lista lo pone la pantalla, en el mismo lugar del
 * «Siguiente» anterior.
 */
export function CierreLectura({ nuevas, todas }: Props) {
  const reducido = useMovimientoReducido();
  const destello = useSharedValue(0);

  useEffect(() => {
    if (!todas || reducido) return;
    destello.value = withDelay(
      motionDuration.lento,
      withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar })
    );
    return () => cancelAnimation(destello);
  }, [todas, reducido, destello]);

  const estiloDestello = useAnimatedStyle(() => ({
    opacity: destello.value > 0 ? OPACIDAD * (1 - destello.value) : 0,
    transform: [{ scale: 1 + CRECE * destello.value }],
  }));

  return (
    <Animated.View entering={reducido ? undefined : aparecerSubiendo()}>
      <Card>
        <View style={styles.contenido}>
          <View style={styles.icono} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Animated.View pointerEvents="none" style={[styles.destello, estiloDestello]} />
            <Icon name="check" size="xl" color={color.accent} />
          </View>
          <Text style={styles.titulo} accessibilityRole="header">
            Terminaste la historia
          </Text>
          <Text style={styles.cuerpo}>{textoNuevas(nuevas)}</Text>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contenido: { alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  icono: { width: LADO, height: LADO, alignItems: 'center', justifyContent: 'center' },
  destello: {
    position: 'absolute',
    width: LADO,
    height: LADO,
    borderRadius: LADO / 2,
    backgroundColor: color.accent,
  },
  titulo: {
    fontFamily: font.family.display,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.25,
    color: color.text,
    textAlign: 'center',
  },
  cuerpo: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    textAlign: 'center',
  },
});
