import React, { useCallback, type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { color, font, layout, radius, shadow, space } from '@/theme';
import * as haptics from '@/services/haptics';
import { Icon, type IconName } from './Icon';
import { Presionable } from './Presionable';

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
  /** Reemplaza al ícono por algo propio (una estrella que se anima). Va donde iría `icon` y sigue `iconAlFinal`. */
  iconNode?: ReactNode;
  /** Algo propio después del texto (un contador que rueda). Es decorativo: el lector oye `accessibilityLabel`. */
  sufijo?: ReactNode;
  style?: ViewStyle;
  /** Capa decorativa detrás de la etiqueta, recortada por el borde del botón (reflejo, onda). */
  fondo?: ReactNode;
  onPressIn?: (e: GestureResponderEvent) => void;
  /** Intensidad del háptico al soltar. Ligero por omisión. */
  haptico?: 'ligero' | 'medio';
}

/** Un botón solo con ícono no tiene texto que leer: su etiqueta es obligatoria. */
type Props = BaseProps &
  (
    | { label: string; accessibilityLabel?: string }
    | { label?: undefined; icon: IconName; accessibilityLabel: string }
  );

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
  iconNode,
  sufijo,
  style,
  fondo,
  onPressIn,
  haptico = 'ligero',
}: Props) {
  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (haptico === 'medio') haptics.tapMedium();
    else haptics.tapLight();
    onPress();
  }, [disabled, loading, onPress, haptico]);

  const blocked = disabled || loading;
  const glifo =
    iconNode ?? (icon ? <Icon name={icon} size={size === 'lg' ? 'lg' : 'md'} color={textColor[variant]} /> : null);

  return (
    <Presionable
      // Al cambiar de variante con el botón ya en pantalla (Escuchar todos / Detener, Guardar / Guardada) el
      // contenido tomaba los colores de la nueva y el fondo se quedaba con los de la anterior: texto e ícono claros
      // sobre cian, a 1.47:1, es decir invisibles. Con la variante en la `key` el botón se monta de nuevo y las dos
      // cosas salen siempre de la misma.
      key={variant}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={handlePress}
      onPressIn={onPressIn}
      disabled={blocked}
      style={[
        styles.base,
        sizes[size],
        variants[variant],
        full && styles.full,
        blocked && styles.blocked,
        style,
      ]}
    >
      {fondo}
      {loading ? (
        <ActivityIndicator color={textColor[variant]} size="small" />
      ) : (
        <View style={styles.row}>
          {!iconAlFinal ? glifo : null}
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
          {sufijo}
          {iconAlFinal ? glifo : null}
        </View>
      )}
    </Presionable>
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
  danger: { backgroundColor: color.wrong, ...shadow.soft },
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

