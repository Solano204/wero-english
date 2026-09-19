import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import {
  color,
  duration,
  font,
  layout,
  presionar,
  radius,
  rebote,
  shadow,
  space,
} from '@/theme';
import * as haptics from '@/services/haptics';
import { Icon, type IconName } from './Icon';
import { useMovimientoReducido } from '@/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface BaseProps {
  /** Para cuando el efecto de tocar no es obvio por el label. */
  accessibilityHint?: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  /** Va antes del texto, con gap 8 y centrado. 20 px en `md`, 24 en `lg`. */
  icon?: IconName;
  /** Pone el ícono después del texto (las flechas de "seguir"). */
  iconAlFinal?: boolean;
  style?: ViewStyle;
}

/** Un botón solo con ícono no tiene texto que leer: su etiqueta es obligatoria. */
type Props = BaseProps &
  (
    | { label: string; accessibilityLabel?: string }
    | { label?: undefined; icon: IconName; accessibilityLabel: string }
  );

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Botón con respuesta táctil inmediata.
 *
 * La escala corre en el hilo de UI con reanimated, no con Animated de
 * React Native, para que no se trabe cuando el hilo de JS está ocupado
 * guardando en SQLite justo después de responder.
 */
export function Button({
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  full = false,
  icon,
  iconAlFinal = false,
  style,
}: Props) {
  const scale = useSharedValue(1);
  const reducido = useMovimientoReducido();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleIn = useCallback(() => {
    scale.value = reducido ? 0.96 : presionar(0.96);
  }, [scale, reducido]);

  const handleOut = useCallback(() => {
    scale.value = reducido ? 1 : rebote(1);
  }, [scale, reducido]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    haptics.tapLight();
    onPress();
  }, [disabled, loading, onPress]);

  const blocked = disabled || loading;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={handlePress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      disabled={blocked}
      style={[
        styles.base,
        sizes[size],
        variants[variant],
        full && styles.full,
        blocked && styles.blocked,
        animStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} size="small" />
      ) : (
        <View style={styles.row}>
          {icon && !iconAlFinal ? (
            <Icon name={icon} size={size === 'lg' ? 'lg' : 'md'} color={textColor[variant]} />
          ) : null}
          {label ? (
            <Text
              style={[
                styles.label,
                { color: textColor[variant] },
                size === 'lg' && styles.labelLg,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ) : null}
          {icon && iconAlFinal ? (
            <Icon name={icon} size={size === 'lg' ? 'lg' : 'md'} color={textColor[variant]} />
          ) : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

const textColor: Record<Variant, string> = {
  primary: color.onAccent,
  secondary: color.text,
  ghost: color.textMuted,
  danger: color.onAccent,
};

/**
 * El borde inferior más oscuro es lo que hace que el botón se lea como
 * una pieza que se puede hundir. Al presionar, la escala baja y la
 * franja parece comprimirse: es el mismo efecto de un botón físico y
 * cuesta dos líneas.
 */
const variants: Record<Variant, ViewStyle> = {
  primary: {
    backgroundColor: color.accent,
    // Sin franja inferior ni halo de color: el cian sólido ya es lo más
    // encendido de la pantalla y una sombra tintada compite con él (IA-3).
    // La sombra negra `soft` solo lo despega del fondo.
    ...shadow.soft,
  },
  secondary: {
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.borderStrong,
    ...shadow.soft,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: color.riskStrong, ...shadow.soft },
};

const sizes: Record<Size, ViewStyle> = {
  md: { minHeight: layout.tapMin, paddingHorizontal: space.lg },
  lg: { minHeight: 58, paddingHorizontal: space.xl },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  full: { alignSelf: 'stretch' },
  blocked: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    letterSpacing: 0.2,
  },
  labelLg: { fontFamily: font.family.body, fontSize: font.size.lg },
});

export const BUTTON_PRESS_MS = duration.instant;
