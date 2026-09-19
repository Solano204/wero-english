import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { color } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const N = 14;

interface Props {
  /** Cambia este número para relanzar el estallido. Cero no dibuja nada. */
  disparo: number;
  /** Color de las chispas. Por defecto, el dorado de las estrellas. */
  tinte?: string;
  /** Dónde revienta, en porcentaje de la capa. Por defecto, el centro. */
  x?: `${number}%`;
  y?: `${number}%`;
}

/**
 * El estallido de chispas para "ganaste" en Cázala.
 *
 * A diferencia de Trozos (cubitos que caen con gravedad, como algo que
 * se rompe), la chispa sale disparada en línea recta en las 360° y se
 * apaga rápido: es luz, no escombro. Por eso el barrido es circular
 * completo (Trozos usa un abanico hacia arriba) y el fundido es más
 * abrupto que el de un cubito cayendo.
 */
export function Chispas({
  disparo,
  tinte = color.world.fonetica,
  x = '50%',
  y = '50%',
}: Props) {
  const reducido = useMovimientoReducido();
  if (disparo === 0 || reducido) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.origen, { left: x, top: y }]}>
        {Array.from({ length: N }).map((_, i) => (
          <Chispa key={`${disparo}-${i}`} i={i} tinte={tinte} />
        ))}
      </View>
    </View>
  );
}

function Chispa({ i, tinte }: { i: number; tinte: string }) {
  const p = useSharedValue(0);

  // Círculo completo, no un abanico: la chispa vuela en cualquier dirección.
  const ang = ((360 * i) / N + (i % 3) * 7) * (Math.PI / 180);
  const distancia = 80 + ((i * 29) % 70);
  const largo = 10 + (i % 4) * 4;
  // La barra nace vertical; se rota para que apunte a lo largo de su trayectoria.
  const grados = (ang * 180) / Math.PI - 90;

  useEffect(() => {
    p.value = withDelay(
      i * 6,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })
    );
  }, [i, p]);

  const anim = useAnimatedStyle(() => {
    const t = p.value;
    return {
      // Brilla y se apaga rápido: una chispa no se queda encendida.
      opacity: t < 0.4 ? 1 : Math.max(0, (1 - t) / 0.6),
      transform: [
        { translateX: Math.cos(ang) * distancia * t },
        // Sin gravedad marcada: casi vuela recto, solo cae un poco al final.
        { translateY: Math.sin(ang) * distancia * t + 24 * t * t },
        { rotate: `${grados}deg` },
        { scaleY: 1 - t * 0.55 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.chispa,
        { height: largo, marginTop: -largo / 2, backgroundColor: tinte },
        anim,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  origen: { position: 'absolute', width: 1, height: 1 },
  chispa: { position: 'absolute', width: 3, marginLeft: -1.5, borderRadius: 1.5 },
});
