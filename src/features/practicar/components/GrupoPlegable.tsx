import React, { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Badge, Icon, Presionable, type IconName } from '@/shared/ui';
import { color, font, layout, motionDuration, motionEasing, radius, space } from '@/theme';
import { conteo } from '@/domain/texto';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** El despliegue del grupo: sus renglones entran escalonados al abrir y todos a la vez al cerrar. */
export interface Avance {
  progreso: SharedValue<number>;
  /** 1 mientras abre (cada renglón espera su `escalon(i)`), 0 mientras cierra (sin escalón). */
  abriendo: SharedValue<number>;
}

interface Props {
  titulo: string;
  icono: IconName;
  total: number;
  abierto: boolean;
  onAlternar: () => void;
  children: (avance: Avance) => ReactNode;
}

/**
 * Grupo que se despliega. Ícono del grupo, nombre y la cuenta en `Badge`; el
 * chevron gira 180° en `base`. Al abrir anima alto y opacidad (`lento`, ease-out)
 * y los renglones entran escalonados; al cerrar, al revés y con ease-in. Con
 * "reducir movimiento" el cambio es inmediato. El contenido se mide una vez con
 * onLayout (va en absoluto para medirse aun con alto 0).
 */
export function GrupoPlegable({ titulo, icono, total, abierto, onAlternar, children }: Props) {
  const reducido = useMovimientoReducido();
  const alto = useSharedValue(0);
  const progreso = useSharedValue(abierto ? 1 : 0);
  const abriendo = useSharedValue(abierto ? 1 : 0);
  const giro = useSharedValue(abierto ? 1 : 0);

  useEffect(() => {
    const meta = abierto ? 1 : 0;
    abriendo.value = meta;
    if (reducido) {
      progreso.value = meta;
      giro.value = meta;
      return;
    }
    // Abrir desacelera; cerrar acelera.
    const easing = abierto ? motionEasing.entrar : motionEasing.salir;
    progreso.value = withTiming(meta, { duration: motionDuration.lento, easing });
    giro.value = withTiming(meta, { duration: motionDuration.base, easing });
  }, [abierto, reducido, progreso, abriendo, giro]);

  const estilo = useAnimatedStyle(() => ({
    height: alto.value * progreso.value,
    opacity: progreso.value,
  }));
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.value * 180}deg` }],
  }));

  return (
    <View style={styles.grupo}>
      <Presionable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityLabel={`${titulo}, ${conteo(total, 'modo')}`}
        accessibilityState={{ expanded: abierto }}
        style={styles.cabecera}
      >
        <View style={styles.identidad}>
          <Icon name={icono} size="md" color={color.textMuted} />
          <Text style={styles.titulo}>{titulo}</Text>
          <Badge label={String(total)} small />
        </View>
        <Animated.View style={chevron}>
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
          {children({ progreso, abriendo })}
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
  identidad: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexShrink: 1 },
  titulo: { flexShrink: 1, fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  cuerpo: { overflow: 'hidden' },
  medida: { position: 'absolute', left: 0, right: 0, top: 0 },
});
