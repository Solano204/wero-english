import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button } from '@/shared/ui';
import {
  aparecerRapido,
  aparecerSubiendo,
  color,
  desaparecer,
  font,
  motionAviso,
  motionDuration,
  motionEasing,
  radius,
  shadow,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

interface Props {
  texto: string;
  /** Con él, el aviso ofrece «Deshacer» y una barra fina cuenta los segundos que quedan; sin él es un aviso simple (un fallo). */
  onDeshacer?: () => void;
}

/**
 * El aviso de abajo de Mi mazo: «Quitada de tu mazo» con el botón «Deshacer», sobre la zona del pulgar. Entra subiendo
 * con un fundido y sale con otro; una barra fina se vacía durante `motionAviso.duracion` (5 s) y quien lo monta lo retira
 * al acabarse. Se anuncia solo al lector de pantalla (`accessibilityLiveRegion`). Con «reducir movimiento» aparece con un
 * fundido, sin subir y sin la barra.
 */
export function AvisoDeshacer({ texto, onDeshacer }: Props) {
  const reducido = useMovimientoReducido();
  const resto = useSharedValue(1);

  useEffect(() => {
    if (!onDeshacer || reducido) return undefined;
    resto.set(1);
    resto.set(withTiming(0, { duration: motionAviso.duracion, easing: motionEasing.lineal }));
    return () => cancelAnimation(resto);
  }, [onDeshacer, reducido, resto]);
  const estiloBarra = useAnimatedStyle(() => ({ transform: [{ scaleX: resto.get() }] }));

  return (
    <Animated.View
      entering={reducido ? aparecerRapido() : aparecerSubiendo()}
      exiting={desaparecer(motionDuration.rapido)}
      style={styles.aviso}
    >
      <View style={styles.fila} accessibilityLiveRegion="polite">
        <Text style={styles.mensaje}>{texto}</Text>
        {onDeshacer ? <Button variant="secondary" label="Deshacer" onPress={onDeshacer} /> : null}
      </View>
      {onDeshacer && !reducido ? (
        <View style={styles.pista} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.barra, estiloBarra]} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  aviso: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceHigh,
    borderWidth: 1,
    borderColor: color.borderStrong,
    overflow: 'hidden',
    ...shadow.raised,
  },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingLeft: space.lg, paddingRight: space.sm, paddingVertical: space.sm },
  mensaje: { flexShrink: 1, fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.text },
  pista: { height: 3, backgroundColor: color.border },
  barra: { flex: 1, backgroundColor: color.accent, transformOrigin: 'left' },
});
