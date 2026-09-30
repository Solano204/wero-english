import React, { useCallback, useContext, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, type AnimatedRef, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { ANUNCIOS_ACTIVOS } from '@/config/monetizacion';
import { FONDO, aparecer, color, desaparecer, layout, resplandorSol, space } from '@/theme';
import { conFinalAsync } from '@/shared/utils/conFinal';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
  /** Contenido fijo abajo, fuera del scroll. */
  footer?: ReactNode;
  /**
   * Flota sobre el contenido, justo encima del footer, sin ocupar lugar: aparecer o irse no
   * mueve nada. Solo sus hijos reciben toques. Sin footer, se apoya en el borde de abajo.
   * Pasa `null` (no `undefined`) mientras no haya nada que mostrar: así el lugar ya está medido
   * para cuando aparezca.
   */
  flotante?: ReactNode;
  /** Luz de escena detrás del contenido (p. ej. la aurora de Practicar). No recibe toques. */
  fondo?: ReactNode;
  /** Encabezado que flota sobre el scroll (p. ej. el título que se comprime). Recibe toques solo en sus hijos. */
  encabezado?: ReactNode;
  /** Si viene, el scroll escribe aquí su desplazamiento en el hilo de UI, sin pasar por JS. */
  scrollY?: SharedValue<number>;
  /** Con `scrollY`: para mover el scroll desde la pantalla con `scrollTo` de Reanimated (llevar algo a la vista). */
  scrollRef?: AnimatedRef<Animated.ScrollView>;
  /** Con `scrollY`: se pone en 0 cuando el dedo toma el scroll, para que una animación de scroll de la pantalla lo suelte. */
  soltarScroll?: SharedValue<number>;
  /** Jalar para refrescar: la pantalla recarga sin esqueleto. Solo con `scroll`. */
  alRefrescar?: () => Promise<unknown>;
  /** Dónde aparece el indicador desde el borde de arriba (debajo de un encabezado flotante). */
  desfaseRefresco?: number;
  /**
   * Fundido cruzado de una carga, para pantallas que pintan su propio esqueleto (no por
   * `<Carga>`): `esqueleto` en la pantalla con huesos (su cuerpo sale con fundido) y
   * `contenido` en la pantalla real (su cuerpo entra con fundido). Solo cuando el
   * esqueleto sí se vio: una carga rápida no se anima. Solo aplica sin `scroll`.
   */
  transicionCarga?: 'esqueleto' | 'contenido';
}

interface PropsScrollAnimado extends ScrollViewProps {
  y: SharedValue<number>;
  refScroll?: AnimatedRef<Animated.ScrollView>;
  soltar?: SharedValue<number>;
}

/** Scroll que publica su desplazamiento en un valor compartido. Solo existe si una pantalla lo pide. */
function ScrollAnimado({ y, refScroll, soltar, ...props }: PropsScrollAnimado) {
  const alDesplazar = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.set(e.contentOffset.y);
    },
    onBeginDrag: () => {
      if (soltar) soltar.set(0);
    },
  });
  return <Animated.ScrollView {...props} ref={refScroll} onScroll={alDesplazar} scrollEventThrottle={16} />;
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
  flotante,
  fondo,
  encabezado,
  scrollY,
  scrollRef,
  soltarScroll,
  alRefrescar,
  desfaseRefresco = 0,
  transicionCarga,
}: Props) {
  const inner: ViewStyle = padded ? { padding: layout.screenPad } : {};
  // Para apoyar `flotante` en el borde de arriba del footer: alto de la pantalla menos dónde empieza el footer.
  const [altoRaiz, setAltoRaiz] = useState(0);
  const [inicioFooter, setInicioFooter] = useState<number | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const refrescar = useCallback(async () => {
    if (!alRefrescar) return;
    setRefrescando(true);
    await conFinalAsync(async () => {
      await alRefrescar();
    }, () => {
      setRefrescando(false);
    });
  }, [alRefrescar]);
  const refreshControl = alRefrescar ? (
    <RefreshControl
      refreshing={refrescando}
      onRefresh={refrescar}
      tintColor={color.accent}
      colors={[color.accent]}
      progressBackgroundColor={color.surface}
      progressViewOffset={desfaseRefresco}
    />
  ) : undefined;

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
  const { bottom: insetAbajo } = useSafeAreaInsets();
  // Con footer no hace falta este colchón: el footer ya reserva su
  // propio espacio fijo abajo, y sumarlo aquí solo le roba altura al
  // contenido de en medio sin ganar nada.
  const huecoAbajo = footer
    ? 0
    : altoPestanas > 0
      ? altoPestanas + (ANUNCIOS_ACTIVOS ? layout.adBar : 0) + insetAbajo + space.xl
      : space.xxxl;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={edges}
      onLayout={flotante !== undefined ? (e) => setAltoRaiz(e.nativeEvent.layout.height) : undefined}
    >
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
       * El sol del sistema, hecho visible. Un resplandor azul arriba a
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
        scrollY ? (
          <ScrollAnimado
            y={scrollY}
            refScroll={scrollRef}
            soltar={soltarScroll}
            style={styles.flex}
            contentContainerStyle={[inner, { paddingBottom: huecoAbajo }, style]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollAnimado>
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[inner, { paddingBottom: huecoAbajo }, style]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        )
      ) : transicionCarga ? (
        // La llave fuerza a montar un cuerpo nuevo al pasar de esqueleto a contenido: así
        // corren a la vez la salida del uno y la entrada del otro.
        <Animated.View
          key={transicionCarga}
          entering={transicionCarga === 'contenido' ? aparecer() : undefined}
          exiting={transicionCarga === 'esqueleto' ? desaparecer() : undefined}
          style={[styles.flex, inner, { paddingBottom: huecoAbajo }, style]}
        >
          {children}
        </Animated.View>
      ) : (
        <View style={[styles.flex, inner, { paddingBottom: huecoAbajo }, style]}>
          {children}
        </View>
      )}
      {encabezado ? (
        <View style={styles.encabezado} pointerEvents="box-none">
          {encabezado}
        </View>
      ) : null}
      {footer ? (
        <View style={styles.footer} onLayout={flotante !== undefined ? (e) => setInicioFooter(e.nativeEvent.layout.y) : undefined}>
          {footer}
        </View>
      ) : null}
      {flotante && (!footer || (inicioFooter !== null && altoRaiz > 0)) ? (
        <View
          style={[styles.flotante, { bottom: footer && inicioFooter !== null ? altoRaiz - inicioFooter : 0 }]}
          pointerEvents="box-none"
        >
          {flotante}
        </View>
      ) : null}
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
  encabezado: { position: 'absolute', top: 0, left: 0, right: 0 },
  flotante: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingBottom: space.sm },
  footer: {
    paddingHorizontal: layout.screenPad,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.borderStrong,
    backgroundColor: color.bgFin,
  },
});
