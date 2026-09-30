import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Icon, Presionable, type IconName } from '@/shared/ui';
import { color, escalon, font, layout, motionDuration, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Avance } from './GrupoPlegable';
import { MetaModo } from './MetaModo';
import { textoMeta, type Meta } from './metadatos';

/** Lado de la ficha del ícono. */
const FICHA = 40;
/** Cuánto avanza el chevron al presionar, en dp. */
const AVANCE_CHEVRON = 4;
/** Ancho del barrido de luz respecto del renglón. */
const ANCHO_BARRIDO = 0.4;
/** Donde empieza el texto: el separador arranca aquí y no en el borde de la tarjeta. */
const SANGRIA = space.lg + FICHA + space.md;

interface Props {
  titulo: string;
  /** Una línea con lo que hace el modo. */
  corta: string;
  icono: IconName;
  /** Sin dato, el renglón queda limpio: no hay `Badge` vacío. */
  meta: Meta | null;
  primera: boolean;
  onPress: () => void;
  /** Posición en el grupo y avance de su despliegue: entra con `escalon(indice)` desde 8 dp más abajo. */
  indice?: number;
  avance?: Avance;
}

/**
 * Renglón de un grupo: ficha con el ícono del modo, nombre, una línea de
 * descripción, el dato como `Badge` y el chevron. Al presionar: escala 0.97
 * (`Presionable`), un barrido de luz `accentSoft` de izquierda a derecha y el
 * chevron avanza 4 dp y regresa. Alto mínimo 56.
 */
export function FilaModo({ titulo, corta, icono, meta, primera, onPress, indice = 0, avance }: Props) {
  const reducido = useMovimientoReducido();
  const retraso = escalon(indice);
  const ancho = useSharedValue(0);
  const barrido = useSharedValue(0);
  const chevron = useSharedValue(0);

  const entrada = useAnimatedStyle(() => {
    const progreso = avance ? avance.progreso.value : 1;
    // Cerrando no hay escalón: todos salen juntos.
    const espera = avance && avance.abriendo.value === 0 ? 0 : retraso;
    const t = interpolate(progreso * motionDuration.lento, [espera, motionDuration.lento], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: (1 - t) * space.sm }] };
  });
  const estiloBarrido = useAnimatedStyle(() => ({
    opacity: interpolate(barrido.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(barrido.value, [0, 1], [-ancho.value * ANCHO_BARRIDO, ancho.value]) }],
  }));
  const estiloChevron = useAnimatedStyle(() => ({ transform: [{ translateX: chevron.value }] }));

  const alPresionar = () => {
    if (reducido) return;
    barrido.value = 0;
    barrido.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
    chevron.value = withSequence(
      withTiming(AVANCE_CHEVRON, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.entrar })
    );
  };

  const dato = textoMeta(meta);
  return (
    <Animated.View style={entrada}>
      <Presionable
        onPress={onPress}
        onPressIn={alPresionar}
        onLayout={(e) => {
          ancho.value = e.nativeEvent.layout.width;
        }}
        accessibilityRole="button"
        accessibilityLabel={dato ? `${titulo}. ${corta}. ${dato}` : `${titulo}. ${corta}`}
        style={styles.fila}
      >
        <Animated.View style={[styles.barrido, estiloBarrido]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', color.accentSoft, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {primera ? null : <View style={styles.separador} />}
        <View style={styles.ficha}>
          <Icon name={icono} size="lg" color={color.textMuted} />
        </View>
        <View style={styles.texto}>
          <Text style={styles.nombre}>{titulo}</Text>
          <Text style={styles.corta}>{corta}</Text>
        </View>
        {meta ? (
          // `Badge` se alinea arriba por sí mismo: aquí va centrado con el resto del renglón.
          <View style={styles.meta}>
            <MetaModo meta={meta} avance={avance} />
          </View>
        ) : null}
        <Animated.View style={estiloChevron}>
          <Icon name="chevron-right" size="md" color={color.textFaint} />
        </Animated.View>
      </Presionable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fila: {
    minHeight: layout.filaModo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    overflow: 'hidden',
  },
  barrido: { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${ANCHO_BARRIDO * 100}%` },
  separador: { position: 'absolute', top: 0, left: SANGRIA, right: 0, height: 1, backgroundColor: color.border },
  ficha: {
    width: FICHA,
    height: FICHA,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { flex: 1 },
  meta: { alignSelf: 'center' },
  nombre: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  corta: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.45,
    color: color.textMuted,
  },
});
