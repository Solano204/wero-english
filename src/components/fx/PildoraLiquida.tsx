import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { color, motionEscalon, motionSpring } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const ANCHO = 54;
const ALTO = 28;
const RADIO = ALTO / 2;

interface Props {
  /** Pestaña activa. */
  indice: number;
  total: number;
  /** Ancho de la barra donde vive: cada pestaña mide `ancho / total`. */
  ancho: number;
  /** Distancia desde el borde de arriba de la barra hasta la píldora. */
  arriba: number;
}

/**
 * La píldora activa de la barra de pestañas. Se desliza entre pestañas con el
 * resorte `liquido` y se estira en el trayecto: la cabeza llega primero y la cola
 * la alcanza un instante después, así que se alarga al salir y se contrae al
 * llegar. Son tres piezas (dos tapas y un cuerpo que se escala) para que las
 * puntas no se deformen; solo se anima `transform`. Con "reducir movimiento"
 * salta a la pestaña.
 */
export function PildoraLiquida({ indice, total, ancho, arriba }: Props) {
  const reducido = useMovimientoReducido();
  const cabeza = useSharedValue(0);
  const cola = useSharedValue(0);
  const colocada = useRef(false);

  useEffect(() => {
    if (ancho === 0) return;
    const destino = (ancho / total) * (indice + 0.5);
    if (reducido || !colocada.current) {
      cabeza.value = destino;
      cola.value = destino;
      colocada.current = true;
      return;
    }
    cabeza.value = withSpring(destino, motionSpring.liquido);
    cola.value = withDelay(motionEscalon.ms, withSpring(destino, motionSpring.liquido));
  }, [indice, ancho, total, reducido, cabeza, cola]);

  const tapaIzquierda = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(cabeza.value, cola.value) - ANCHO / 2 }],
  }));
  const tapaDerecha = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(cabeza.value, cola.value) + ANCHO / 2 - RADIO }],
  }));
  const cuerpo = useAnimatedStyle(() => {
    const izquierda = Math.min(cabeza.value, cola.value) - ANCHO / 2 + RADIO;
    const derecha = Math.max(cabeza.value, cola.value) + ANCHO / 2 - RADIO;
    return { transform: [{ translateX: izquierda }, { scaleX: Math.max(derecha - izquierda, 0.001) }] };
  });

  return (
    <View style={[styles.pista, { top: arriba }]} pointerEvents="none">
      <Animated.View style={[styles.tapaIzquierda, tapaIzquierda]} />
      <Animated.View style={[styles.cuerpo, cuerpo]} />
      <Animated.View style={[styles.tapaDerecha, tapaDerecha]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pista: { position: 'absolute', left: 0, right: 0, height: ALTO },
  tapaIzquierda: {
    position: 'absolute',
    width: RADIO,
    height: ALTO,
    borderTopLeftRadius: RADIO,
    borderBottomLeftRadius: RADIO,
    backgroundColor: color.accentSoft,
  },
  tapaDerecha: {
    position: 'absolute',
    width: RADIO,
    height: ALTO,
    borderTopRightRadius: RADIO,
    borderBottomRightRadius: RADIO,
    backgroundColor: color.accentSoft,
  },
  cuerpo: {
    position: 'absolute',
    width: 1,
    height: ALTO,
    transformOrigin: 'left center',
    backgroundColor: color.accentSoft,
  },
});
