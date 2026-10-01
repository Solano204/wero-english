import React, { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { color, motionDuration, motionEasing, motionSpring, radius, sol } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** El velo nunca pasa de esto: lo de atrás sigue leyéndose. */
const VELO_MAX = 0.5;
/** El grosor del filo de luz de la hoja. */
export const FILO_HOJA = 1;

interface Props {
  visible: boolean;
  /** Los colores del filo de luz de 1 px de arriba. */
  filo: readonly [string, string, ...string[]];
  /** El cuerpo: fondo, relleno, separación y alineación. El radio de arriba y el recorte los pone la hoja. */
  estiloCuerpo?: StyleProp<ViewStyle>;
  /**
   * El velo detrás de la hoja: `no` (sin velo, lo de atrás se sigue tocando), `pasa` (se ve, los toques pasan) o
   * `bloquea` (se ve y no deja tocar lo de atrás).
   */
  velo?: 'no' | 'pasa' | 'bloquea';
  /** Espera (ms) antes de que suban el velo y la hoja, también con movimiento reducido. */
  retraso?: number;
  /** Espera (ms) solo del resorte: con movimiento reducido la hoja aparece sin ella. */
  retrasoSubida?: number;
  /** Lo que el dedo corre la hoja al arrastrarla (dp), sumado a su posición. */
  arrastre?: SharedValue<number>;
  /** Un gesto sobre la hoja (p. ej. deslizar hacia arriba para seguir). */
  gesto?: GestureType;
  /** El alto de la hoja al acomodarse. */
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Lo que el lector de pantalla anuncia del cuerpo. */
  accessibilityLabel?: string;
  children: ReactNode;
}

/**
 * La hoja inferior de la app, en la zona del pulgar, sin `Modal`: una vista sobre la pantalla que sube desde abajo con
 * el resorte `rebote` y baja en `rapido`; con «reducir movimiento» no sube, aparece y se va con un fundido. Lleva el
 * filo de luz de 1 px arriba (se apoya en el borde de la pantalla) y, si se pide, un velo de a lo más 0.5 detrás.
 * Oculta, no recibe toques ni la ve el lector de pantalla. Conservar el contenido mientras baja es de quien la usa
 * (`useUltimo`): así no se vacía a media salida.
 *
 * La usan el veredicto de Estudio, la pregunta de Dulces y la pausa de Caída. La hoja de consentimiento sigue en un
 * `Modal` porque tiene que cubrir también el encabezado y responder al botón atrás.
 */
export function Hoja({
  visible,
  filo,
  estiloCuerpo,
  velo = 'no',
  retraso = 0,
  retrasoSubida = 0,
  arrastre,
  gesto,
  onLayout,
  accessibilityLabel,
  children,
}: Props) {
  const reducido = useMovimientoReducido();
  const { height: alturaVentana } = useWindowDimensions();
  const y = useSharedValue(alturaVentana);
  const veloValor = useSharedValue(0);
  const opacidad = useSharedValue(reducido ? 0 : 1);

  useEffect(() => {
    const entrar = { duration: motionDuration.base, easing: motionEasing.entrar };
    const salir = { duration: motionDuration.rapido, easing: motionEasing.salir };
    const conRetraso = (animacion: number, ms: number) => (ms > 0 ? withDelay(ms, animacion) : animacion);
    if (visible) {
      if (velo !== 'no') veloValor.set(conRetraso(withTiming(1, entrar), retraso));
      if (reducido) {
        y.set(0);
        opacidad.set(conRetraso(withTiming(1, entrar), retraso));
      } else {
        opacidad.set(1);
        y.set(conRetraso(withSpring(0, motionSpring.rebote), retraso + retrasoSubida));
      }
    } else {
      if (velo !== 'no') veloValor.set(withTiming(0, salir));
      if (reducido) opacidad.set(withTiming(0, salir));
      else y.set(withTiming(alturaVentana, salir));
    }
  }, [visible, reducido, alturaVentana, velo, retraso, retrasoSubida, y, veloValor, opacidad]);

  const hojaAnim = useAnimatedStyle(() => ({
    opacity: opacidad.get(),
    transform: [{ translateY: y.get() + (arrastre ? arrastre.get() : 0) }],
  }));
  const veloAnim = useAnimatedStyle(() => ({ opacity: veloValor.get() * VELO_MAX }));

  const lamina = (
    <LinearGradient colors={filo} start={sol.start} end={sol.end} style={styles.filo}>
      <View style={[styles.cuerpo, estiloCuerpo]} accessibilityLiveRegion="polite" accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    </LinearGradient>
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? (velo === 'bloquea' ? 'auto' : 'box-none') : 'none'}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!visible}
    >
      {velo === 'no' ? null : (
        <Animated.View
          pointerEvents={velo === 'bloquea' ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, styles.velo, veloAnim]}
        />
      )}
      <Animated.View style={[styles.hoja, hojaAnim]} onLayout={onLayout}>
        {gesto ? (
          <GestureDetector gesture={gesto}>
            <Animated.View>{lamina}</Animated.View>
          </GestureDetector>
        ) : (
          lamina
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  velo: { backgroundColor: color.velo },
  hoja: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  filo: {
    padding: FILO_HOJA,
    paddingBottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  cuerpo: {
    borderTopLeftRadius: radius.xl - FILO_HOJA,
    borderTopRightRadius: radius.xl - FILO_HOJA,
    overflow: 'hidden',
  },
});
