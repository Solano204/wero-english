import React, { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Badge, Icon, Presionable } from '@/shared/ui';
import { color, font, layout, motionDuration, motionEasing, radius, space, text } from '@/theme';
import { conteo } from '@/domain/texto';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** El despliegue del bloque: sus renglones entran escalonados al abrir y todos a la vez al cerrar. */
export interface Avance {
  progreso: SharedValue<number>;
  /** 1 mientras abre (cada renglón espera su `escalon(i)`), 0 mientras cierra (sin escalón). */
  abriendo: SharedValue<number>;
}

interface Props {
  nombre: string;
  resumen: string;
  total: number;
  abierto: boolean;
  onAlternar: () => void;
  children: (avance: Avance) => ReactNode;
}

/**
 * Un bloque de Gramática como tarjeta, igual que los grupos de Practicar: nombre, una línea de qué reúne, la cuenta
 * en `Badge` y el chevron, que gira 180° en `base`. Los temas viven dentro, como renglones con separador. Al abrir
 * anima alto y opacidad (`lento`, ease-out) y los renglones entran escalonados; al cerrar, al revés y con ease-in.
 * Con "reducir movimiento" el cambio es inmediato. Los renglones se montan la primera vez que se abre (ochenta temas
 * a la vez pesan en un teléfono modesto) y el contenido se mide una vez con onLayout: va en absoluto para medirse
 * aun con alto 0.
 */
export function BloqueGramatica({ nombre, resumen, total, abierto, onAlternar, children }: Props) {
  const reducido = useMovimientoReducido();
  const alto = useSharedValue(0);
  const progreso = useSharedValue(abierto ? 1 : 0);
  const abriendo = useSharedValue(abierto ? 1 : 0);
  const giro = useSharedValue(abierto ? 1 : 0);
  const [montado, setMontado] = useState(abierto);

  useEffect(() => {
    const meta = abierto ? 1 : 0;
    if (abierto) setMontado(true);
    abriendo.set(meta);
    if (reducido) {
      progreso.set(meta);
      giro.set(meta);
      return;
    }
    // Abrir desacelera; cerrar acelera.
    const easing = abierto ? motionEasing.entrar : motionEasing.salir;
    progreso.set(withTiming(meta, { duration: motionDuration.lento, easing }));
    giro.set(withTiming(meta, { duration: motionDuration.base, easing }));
    return () => {
      cancelAnimation(progreso);
      cancelAnimation(giro);
    };
  }, [abierto, reducido, progreso, abriendo, giro]);

  const estilo = useAnimatedStyle(() => ({
    height: alto.get() * progreso.get(),
    opacity: progreso.get(),
  }));
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.get() * 180}deg` }],
  }));

  return (
    <View style={styles.bloque}>
      <Presionable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityLabel={`${nombre}, ${conteo(total, 'tema')}. ${resumen}`}
        accessibilityState={{ expanded: abierto }}
        style={styles.cabecera}
      >
        <View style={styles.identidad}>
          <Text style={text.h3}>{nombre}</Text>
          <Text style={styles.resumen}>{resumen}</Text>
        </View>
        <View style={styles.cola}>
          <Badge label={String(total)} small />
          <Animated.View style={chevron}>
            <Icon name="chevron-down" size="md" color={color.textMuted} />
          </Animated.View>
        </View>
      </Presionable>

      <Animated.View
        style={[styles.cuerpo, estilo, { pointerEvents: abierto ? 'auto' : 'none' }]}
        accessibilityElementsHidden={!abierto}
        importantForAccessibility={abierto ? 'auto' : 'no-hide-descendants'}
      >
        <View
          style={styles.medida}
          onLayout={(e) => {
            alto.set(e.nativeEvent.layout.height);
          }}
        >
          {montado ? children({ progreso, abriendo }) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: {
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
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  identidad: { flex: 1, gap: space.xs },
  cola: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resumen: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.45,
    color: color.textMuted,
  },
  cuerpo: { overflow: 'hidden' },
  medida: { position: 'absolute', left: 0, right: 0, top: 0 },
});
