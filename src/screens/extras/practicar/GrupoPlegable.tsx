import React, { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from '@/components/base';
import { color, font, layout, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const DURACION_MS = 200;

interface Props {
  titulo: string;
  total: number;
  abierto: boolean;
  onAlternar: () => void;
  children: ReactNode;
}

/**
 * Grupo que se despliega. Solo anima alto y opacidad, 200 ms con salida
 * suave; con "reducir movimiento" el cambio es inmediato. El contenido se
 * mide una vez con onLayout (va en absoluto para medirse aun con alto 0).
 */
export function GrupoPlegable({ titulo, total, abierto, onAlternar, children }: Props) {
  const reducido = useMovimientoReducido();
  const alto = useSharedValue(0);
  const progreso = useSharedValue(abierto ? 1 : 0);

  useEffect(() => {
    const meta = abierto ? 1 : 0;
    progreso.value = reducido
      ? meta
      : withTiming(meta, { duration: DURACION_MS, easing: motionEasing.salida });
  }, [abierto, reducido, progreso]);

  const estilo = useAnimatedStyle(() => ({
    height: alto.value * progreso.value,
    opacity: progreso.value,
  }));

  return (
    <View style={styles.grupo}>
      <Pressable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityLabel={`${titulo}, ${total} modos`}
        accessibilityState={{ expanded: abierto }}
        style={styles.cabecera}
      >
        <Text style={styles.titulo}>{`${titulo} · ${total}`}</Text>
        <Icon name={abierto ? 'chevron-up' : 'chevron-down'} size="md" color={color.textMuted} />
      </Pressable>

      <Animated.View
        style={[styles.cuerpo, estilo, { pointerEvents: abierto ? 'auto' : 'none' }]}
        accessibilityElementsHidden={!abierto}
        importantForAccessibility={abierto ? 'auto' : 'no-hide-descendants'}
      >
        <View
          style={styles.medida}
          onLayout={(e) => {
            alto.value = e.nativeEvent.layout.height;
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    overflow: 'hidden',
  },
  cabecera: {
    minHeight: layout.tapMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  titulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  cuerpo: { overflow: 'hidden' },
  medida: { position: 'absolute', left: 0, right: 0, top: 0 },
});
