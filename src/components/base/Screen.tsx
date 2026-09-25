import React, { useContext, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { FONDO, color, layout, radius, resplandorSol, space } from '@/theme';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
  /** Contenido fijo abajo, fuera del scroll. */
  footer?: ReactNode;
  /** Luz de escena detrás del contenido (p. ej. la aurora de Practicar). No recibe toques. */
  fondo?: ReactNode;
}

/**
 * Contenedor de pantalla. Centraliza el fondo, el safe area y el padding
 * para que ninguna pantalla los redefina y se vean distintas entre sí.
 *
 * Por omisión respeta arriba Y abajo. El borde de abajo importa más de
 * lo que parece: en teléfonos con navegación por gestos, la franja del
 * gesto se come los últimos 20 px, y ahí es justo donde vive el botón
 * principal de media app. Sin este margen el usuario toca el botón y le
 * responde el sistema.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'bottom'],
  style,
  footer,
  fondo,
}: Props) {
  const inner: ViewStyle = padded ? { padding: layout.screenPad } : {};

  /*
   * Hueco de las barras de abajo.
   *
   * La barra de pestañas FLOTA sobre el contenido, así que la última
   * tarjeta de cualquier lista quedaba debajo de ella y no se podía
   * leer ni tocar. El scroll tiene que terminar por encima.
   *
   * `BottomTabBarHeightContext` devuelve undefined fuera de las
   * pestañas, que es justo lo que hace falta: un detalle o un juego se
   * abren en el Stack, tapan las pestañas y no deben reservar ese hueco
   * ni dejar un agujero muerto al final.
   *
   * Se usa el contexto y no `useBottomTabBarHeight()` porque ese lanza
   * si no hay pestañas, y este componente se usa en las dos
   * situaciones.
   */
  const altoPestanas = useContext(BottomTabBarHeightContext) ?? 0;
  // Con footer no hace falta este colchón: el footer ya reserva su
  // propio espacio fijo abajo, y sumarlo aquí solo le roba altura al
  // contenido de en medio sin ganar nada.
  const huecoAbajo = footer
    ? 0
    : altoPestanas > 0
      ? altoPestanas + layout.adBar + space.xl
      : space.xxxl;

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {/*
       * El degradado del fondo es deliberadamente sutil: no está para
       * verse, está para que las tarjetas blancas floten. Sobre un
       * fondo plano del mismo tono, una tarjeta blanca necesita borde o
       * sombra dura para leerse, y las dos cosas se ven pesadas.
       */}
      <LinearGradient
        // FONDO es una constante del tema: no se recrea en cada render,
        // así que el degradado no se vuelve a compilar al navegar.
        colors={FONDO}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/*
       * El sol del sistema, hecho visible. Un resplandor cian arriba a
       * la izquierda que da profundidad al fondo y justifica que todos
       * los filos de las tarjetas brillen hacia ese lado.
       */}
      <LinearGradient
        colors={resplandorSol}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.resplandor}
        pointerEvents="none"
      />
      {fondo}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[inner, { paddingBottom: huecoAbajo }, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner, { paddingBottom: huecoAbajo }, style]}>
          {children}
        </View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg, overflow: 'hidden' },
  resplandor: {
    position: 'absolute',
    top: -80,
    left: -90,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  flex: { flex: 1 },
  footer: {
    paddingHorizontal: layout.screenPad,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.borderStrong,
    backgroundColor: color.bgFin,
  },
});
