import React, { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Badge, Icon, Presionable } from '@/components/base';
import { color, font, layout, motionEasing, radius, space, motionDuration } from '@/theme';
import { useMovimientoReducido } from '@/utils';

interface Props {
  titulo: string;
  total: number;
  abierto: boolean;
  onAlternar: () => void;
  /** Recibe el avance del despliegue (0 a 1) para que las filas entren escalonadas. */
  children: (progreso: SharedValue<number>) => ReactNode;
}

/**
 * Grupo que se despliega. Anima alto y opacidad, el chevron gira 180° y las
 * filas entran escalonadas (`escalon(i)`), todo con salida suave; con "reducir movimiento" el cambio es inmediato. El contenido se
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
      : withTiming(meta, {
          duration: motionDuration.lento,
          // Abrir desacelera; cerrar acelera.
          easing: abierto ? motionEasing.entrar : motionEasing.salir,
        });
  }, [abierto, reducido, progreso]);

  const estilo = useAnimatedStyle(() => ({
    height: alto.value * progreso.value,
    opacity: progreso.value,
  }));
  const giro = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progreso.value * 180}deg` }],
  }));

  return (
    <View style={styles.grupo}>
      <Presionable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityLabel={`${titulo}, ${total} modos`}
        accessibilityState={{ expanded: abierto }}
        style={styles.cabecera}
      >
        <View style={styles.tituloFila}>
          <Text style={styles.titulo}>{titulo}</Text>
          <Badge label={String(total)} small />
        </View>
        <Animated.View style={giro}>
          <Icon name="chevron-down" size="md" color={color.textMuted} />
        </Animated.View>
      </Presionable>

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
          {children(progreso)}
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
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  cuerpo: { overflow: 'hidden' },
  medida: { position: 'absolute', left: 0, right: 0, top: 0 },
});
