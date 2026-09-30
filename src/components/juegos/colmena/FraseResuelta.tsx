import React, { useEffect, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { type VozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { color, font, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Entry } from '@/types';

/** La frase sube este poco mientras se aclara. */
const SUBE = 8;

interface Props {
  entry: Entry;
  /** Las palabras con sus tiempos (`analizar().palabras`), para el karaoke. */
  palabras: ComponentProps<typeof FraseKaraoke>['palabras'];
  voz: VozEnVivo;
  /** La ronda terminó porque se acabó el tiempo: sin esta línea las ranuras ámbar no se explican. */
  seAcabo: boolean;
  /** Cuánto espera en aparecer: lo que tarda en llegar la última ficha. */
  retraso: number;
  /** Se pasa a la ronda siguiente: la frase se desvanece. */
  saliendo: boolean;
  /** El alto mínimo: el del panal, que esta frase reemplaza sin mover nada de lo que hay arriba. */
  alto: number;
}

/**
 * La frase resuelta, en el lugar del panal: en inglés con sus espacios, en `lg` (28, el h2 de la app) y con
 * karaoke sincronizado con el audio que arranca al resolver; debajo, la traducción en `textMuted`. Si se acabó el
 * tiempo lo dice una línea con `clock`. Con «reducir movimiento» solo se aclara, sin subir ni esperar.
 */
export function FraseResuelta({ entry, palabras, voz, seAcabo, retraso, saliendo, alto }: Props) {
  const reducido = useMovimientoReducido();
  const visible = useSharedValue(0);

  useEffect(() => {
    const cfg = { duration: reducido ? motionDuration.rapido : motionDuration.base, easing: motionEasing.entrar };
    if (saliendo) {
      visible.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });
      return;
    }
    visible.value = reducido || retraso <= 0 ? withTiming(1, cfg) : withDelay(retraso, withTiming(1, cfg));
  }, [saliendo, retraso, reducido, visible]);

  const estilo = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: reducido ? 0 : (1 - visible.value) * SUBE }],
  }));

  return (
    <Animated.View style={[styles.caja, { minHeight: alto }, estilo]}>
      {seAcabo ? (
        <View style={styles.aviso}>
          <Icon name="clock" size="sm" color={color.textMuted} />
          <Text style={styles.avisoTexto}>Se acabó el tiempo</Text>
        </View>
      ) : null}
      <FraseKaraoke palabras={palabras} voz={voz} tamano="lg" />
      <Text style={styles.traduccion}>{entry.spanish_main}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  caja: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  avisoTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  traduccion: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    textAlign: 'center',
  },
});
