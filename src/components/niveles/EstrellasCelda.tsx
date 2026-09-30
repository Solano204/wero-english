import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon, ICON_SIZE } from '@/components/base/Icon';
import { color, motionDuration, motionEasing, motionLogro, motionSpring } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';

const LADO = ICON_SIZE.sm;
/** Hasta cuánto crece el destello dorado de una estrella nueva. */
const CRECE_DESTELLO = 1.4;
const OPACIDAD_DESTELLO = 0.5;

interface Encendida {
  retraso: number;
  destello: boolean;
}

/** Una estrella que se enciende: llega con el resorte `rebote` y, si toca, un destello dorado detrás. */
function EstrellaEncendida({ retraso, destello }: Encendida) {
  const reducido = useMovimientoReducido();
  const llegada = useSharedValue(reducido ? 1 : 0);
  const luz = useSharedValue(reducido ? 1 : 0);

  useEffect(() => {
    if (reducido) return;
    llegada.value = withDelay(retraso, withSpring(1, motionSpring.rebote));
    luz.value = withDelay(retraso, withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar }));
  }, [reducido, retraso, llegada, luz]);

  const estrella = useAnimatedStyle(() => ({ opacity: Math.min(1, llegada.value * 2), transform: [{ scale: llegada.value }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: OPACIDAD_DESTELLO * (1 - luz.value),
    transform: [{ scale: 1 + (CRECE_DESTELLO - 1) * luz.value }],
  }));

  return (
    <>
      {destello && !reducido ? <Animated.View pointerEvents="none" style={[styles.destello, halo]} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, styles.centro, estrella]}>
        <Icon name="star-filled" size="sm" color={color.star} />
      </Animated.View>
    </>
  );
}

interface Props {
  /** Cuántas van encendidas (las que tiene el nivel). */
  llenas: number;
  colorVacia: string;
  /** Las estrellas desde este índice (0 a 2) se encienden con animación; las de antes ya estaban. */
  encenderDesde?: number;
  /** Espera (ms) antes de la primera que se enciende. */
  retraso?: number;
  /** Cada estrella nueva lleva un destello dorado (un logro), no solo la llegada. */
  destello?: boolean;
  /** Ms entre una estrella que se enciende y la siguiente. */
  entre?: number;
}

/**
 * Las tres estrellas de una celda. Las apagadas son el contorno en `colorVacia`; las
 * llenas, `star-filled` en `star`. Con `encenderDesde`, las de ese índice en adelante se
 * encienden una tras otra: en cascada al entrar a un tramo, o con un destello dorado cuando
 * son estrellas nuevas. Con reducir movimiento ya están encendidas.
 */
export function EstrellasCelda({ llenas, colorVacia, encenderDesde, retraso = 0, destello = false, entre = motionLogro.entreEstrellas }: Props) {
  return (
    <View style={styles.fila}>
      {[0, 1, 2].map((i) => {
        const llena = i < llenas;
        const animada = llena && encenderDesde !== undefined && i >= encenderDesde;
        return (
          <View key={i} style={styles.ranura}>
            {llena && !animada ? <Icon name="star-filled" size="sm" color={color.star} /> : <Icon name="star" size="sm" color={colorVacia} />}
            {animada ? <EstrellaEncendida retraso={retraso + (i - (encenderDesde ?? 0)) * entre} destello={destello} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
  ranura: { width: LADO, height: LADO, alignItems: 'center', justifyContent: 'center' },
  centro: { alignItems: 'center', justifyContent: 'center' },
  destello: { position: 'absolute', width: LADO, height: LADO, borderRadius: LADO / 2, backgroundColor: color.star },
});
