import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { Presionable } from '@/shared/ui/Presionable';
import { color, font, layout, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

interface Props {
  titulo: string;
  /** El texto que se despliega. */
  nota: string;
}

/**
 * Un botón de texto que despliega una nota: alto y opacidad en `lento` con ease-out
 * al abrir y ease-in al cerrar, y el chevron gira 180° en `base`. Con reducir
 * movimiento el cambio es inmediato. El texto se mide una vez (va en absoluto para
 * medirse aun con alto 0), igual que los grupos de Practicar.
 */
export function NotaPlegable({ titulo, nota }: Props) {
  const reducido = useMovimientoReducido();
  const [abierta, setAbierta] = useState(false);
  const alto = useSharedValue(0);
  const progreso = useSharedValue(0);
  const giro = useSharedValue(0);

  useEffect(() => {
    const meta = abierta ? 1 : 0;
    if (reducido) {
      progreso.value = meta;
      giro.value = meta;
      return;
    }
    const easing = abierta ? motionEasing.entrar : motionEasing.salir;
    progreso.value = withTiming(meta, { duration: motionDuration.lento, easing });
    giro.value = withTiming(meta, { duration: motionDuration.base, easing });
  }, [abierta, reducido, progreso, giro]);

  const cuerpo = useAnimatedStyle(() => ({ height: alto.value * progreso.value, opacity: progreso.value }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value * 180}deg` }] }));

  return (
    <View style={styles.wrap}>
      <Presionable
        onPress={() => setAbierta((a) => !a)}
        accessibilityRole="button"
        accessibilityLabel={titulo}
        accessibilityState={{ expanded: abierta }}
        style={styles.cabecera}
      >
        <Text style={styles.titulo}>{titulo}</Text>
        <Animated.View style={chevron}>
          <Icon name="chevron-down" size="md" color={color.accent} />
        </Animated.View>
      </Presionable>

      <Animated.View
        style={[styles.cuerpo, cuerpo, { pointerEvents: abierta ? 'auto' : 'none' }]}
        accessibilityElementsHidden={!abierta}
        importantForAccessibility={abierta ? 'auto' : 'no-hide-descendants'}
      >
        <View style={styles.medida} onLayout={(e) => (alto.value = e.nativeEvent.layout.height)}>
          <Text style={styles.texto}>{nota}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  cabecera: {
    minHeight: layout.tapMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  titulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.accent },
  cuerpo: { overflow: 'hidden' },
  medida: { position: 'absolute', left: 0, right: 0, top: 0 },
  texto: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.5,
    textAlign: 'center',
    paddingBottom: space.sm,
  },
});
