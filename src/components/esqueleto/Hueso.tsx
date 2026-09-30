import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { brilloEsqueleto, color, layout, motionCiclo, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';

/** Con «reducir movimiento» el hueso se queda fijo a esta opacidad, sin brillo. */
const OPACIDAD_REDUCIDA = 0.6;

/** El valor compartido del brillo (null con «reducir movimiento»: ningún hueso bajo este proveedor lo dibuja). */
const EsqueletoContexto = createContext<SharedValue<number> | null>(null);

interface ProveedorProps {
  /** Lo que anuncia el lector de pantalla una sola vez. */
  etiqueta?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Un solo valor compartido de Reanimated maneja el brillo de TODOS los huesos
 * que cuelgan de aquí: brillan sincronizados y cuesta un bucle, no uno por
 * hueso. Un `ProveedorEsqueleto` por pantalla (o por sección independiente),
 * nunca anidado dentro de otro.
 */
export function ProveedorEsqueleto({ etiqueta = 'Cargando', children, style }: ProveedorProps) {
  const reducido = useMovimientoReducido();
  const brillo = useSharedValue(0);

  useEffect(() => {
    if (reducido) return;
    brillo.value = withRepeat(
      withTiming(1, { duration: motionCiclo.brilloEsqueleto, easing: motionEasing.lineal }),
      -1,
      false
    );
  }, [reducido, brillo]);

  return (
    <EsqueletoContexto.Provider value={reducido ? null : brillo}>
      <View style={style} accessibilityLabel={etiqueta} accessibilityRole="progressbar">
        {children}
      </View>
    </EsqueletoContexto.Provider>
  );
}

interface HuesoProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * El bloque base: `surfaceAlt`, el radio que se le pida y, si algún
 * `ProveedorEsqueleto` lo cubre, un brillo que lo cruza de lado a lado cada
 * `motionCiclo.brilloEsqueleto`. Sin proveedor (o con «reducir movimiento»)
 * se queda fijo a `OPACIDAD_REDUCIDA`, sin animar nada.
 */
export function Hueso({ width = '100%', height, radius: r = radius.sm, style }: HuesoProps) {
  const brillo = useContext(EsqueletoContexto);
  const ancho = useSharedValue(0);

  const estiloBrillo = useAnimatedStyle(() => {
    if (!brillo) return { opacity: 0 };
    const w = ancho.value || 1;
    return { opacity: 1, transform: [{ translateX: (brillo.value * 2 - 1) * w }] };
  });

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        ancho.value = e.nativeEvent.layout.width;
      }}
      style={[
        styles.hueso,
        { width, borderRadius: r, opacity: brillo ? 1 : OPACIDAD_REDUCIDA },
        height !== undefined ? { height } : null,
        style,
      ]}
    >
      {brillo ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, estiloBrillo]}>
          <LinearGradient
            colors={brilloEsqueleto}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

interface HuesoTextoProps {
  /** Cuántas líneas: la última siempre más corta, como un párrafo de verdad. */
  lineas?: number;
  anchos?: DimensionValue[];
  alto?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

const ANCHOS_TEXTO: DimensionValue[] = ['100%', '85%', '60%'];

/** Líneas de texto con anchos distintos: un bloque parejo delata que es relleno, no lo que va a haber ahí. */
export function HuesoTexto({ lineas = 3, anchos = ANCHOS_TEXTO, alto = 14, gap = space.sm, style }: HuesoTextoProps) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lineas }, (_, i) => (
        <Hueso key={i} height={alto} width={anchos[Math.min(i, anchos.length - 1)]} />
      ))}
    </View>
  );
}

/** Un título: una sola línea más alta, como un h2/h3. */
export function HuesoTitulo({
  width = '70%',
  style,
}: {
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
}) {
  return <Hueso width={width} height={22} style={style} />;
}

/** Un botón: pill del alto táctil de verdad (`md` = 48, `lg` = 58). */
export function HuesoBoton({
  width = '100%',
  size = 'md',
  style,
}: {
  width?: DimensionValue;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  return <Hueso width={width} height={size === 'lg' ? 58 : layout.tapMin} radius={radius.pill} style={style} />;
}

/** Un círculo: avatar, ícono grande, anillo de meta. */
export function HuesoCirculo({ diametro = 48, style }: { diametro?: number; style?: StyleProp<ViewStyle> }) {
  return <Hueso width={diametro} height={diametro} radius={diametro / 2} style={style} />;
}

/** Un marco de imagen 16:9, como `MarcoImagen`. */
export function HuesoImagen({ style }: { style?: StyleProp<ViewStyle> }) {
  return <Hueso width="100%" radius={radius.md} style={[styles.imagen, style]} />;
}

interface HuesoTarjetaProps {
  /** Con portada 16:9 arriba, o sin ella (solo texto). */
  imagen?: boolean;
  lineas?: number;
  style?: StyleProp<ViewStyle>;
}

/** Una tarjeta genérica: opcional portada, título y un párrafo corto. La forma que más se repite en listas. */
export function HuesoTarjeta({ imagen = false, lineas = 2, style }: HuesoTarjetaProps) {
  return (
    <View style={[styles.tarjeta, style]}>
      {imagen ? <HuesoImagen /> : null}
      <HuesoTitulo width="60%" />
      <HuesoTexto lineas={lineas} />
    </View>
  );
}

const styles = StyleSheet.create({
  hueso: {
    backgroundColor: color.surfaceAlt,
    overflow: 'hidden',
  },
  imagen: { aspectRatio: 16 / 9 },
  tarjeta: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
});
