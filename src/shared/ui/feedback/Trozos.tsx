import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming } from 'react-native-reanimated';
import { useDesfaseVentana } from '@/shared/ui/fx/useDesfaseVentana';
import { color, motionEasing, motionEfecto } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

const N = 12;

interface Props {
  /** Cambia este número para relanzar el estallido. Cero no dibuja nada. */
  disparo: number;
  /** Color de los cubitos. Por defecto, el acento. */
  tinte?: string;
  /** Dónde revienta, en porcentaje de la capa. Por defecto, el centro. */
  x?: `${number}%`;
  y?: `${number}%`;
  /**
   * Dónde revienta, en píxeles de la ventana (lo que da `measureInWindow`): sale de una
   * pieza concreta, como la opción que acertaste. Manda sobre `x` e `y`. Puede llegar un
   * cuadro después del disparo: los cubitos apenas se han movido y salen del punto nuevo.
   */
  origen?: { x: number; y: number };
}

/**
 * La caja que se rompe en cubitos.
 *
 * Doce trozos, no cuarenta: en un teléfono de gama baja cada trozo es
 * una vista animada, y el estallido tiene que salir en el mismo
 * fotograma del acierto o deja de sentirse como consecuencia de lo que
 * hiciste.
 *
 * Los cubitos caen con gravedad en vez de irse en línea recta. Una
 * explosión radial perfecta se ve a máquina; que caigan se ve a cosa
 * rota, que es lo que se quiere.
 *
 * Todo va en píxeles: dentro de una vista absoluta, un porcentaje en el
 * margen o en el alto no resuelve bien en Android y arrastra el layout
 * del padre. Ese error ya nos costó una pantalla entera.
 */
export function Trozos({ disparo, tinte = color.accent, x = '50%', y = '50%', origen }: Props) {
  const reducido = useMovimientoReducido();
  const { ref, alAcomodar, desfase } = useDesfaseVentana();
  if (reducido) return null;
  const punto = origen ? { left: origen.x - desfase.x, top: origen.y - desfase.y } : { left: x, top: y };
  return (
    <View ref={ref} collapsable={false} onLayout={alAcomodar} style={StyleSheet.absoluteFill} pointerEvents="none">
      {disparo > 0 ? (
        <View style={[styles.origen, punto]}>
          {Array.from({ length: N }).map((_, i) => (
            <Cubo key={`${disparo}-${i}`} i={i} tinte={tinte} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Cubo({ i, tinte }: { i: number; tinte: string }) {
  const p = useSharedValue(0);

  // Abanico hacia arriba: de -160° a -20°. Nada sale hacia abajo al
  // principio, porque la gravedad se encarga de eso después.
  const ang = (-160 + (140 * i) / (N - 1)) * (Math.PI / 180);
  const fuerza = 70 + ((i * 37) % 60);
  const lado = 7 + (i % 3) * 3;
  const giro = (i % 2 === 0 ? 1 : -1) * (180 + (i % 4) * 90);

  useEffect(() => {
    p.set(withDelay(
      i * motionEfecto.trozosEscalon,
      withTiming(1, { duration: motionEfecto.trozos, easing: motionEasing.entrar })
    ));
  }, [i, p]);

  const anim = useAnimatedStyle(() => {
    const t = p.get();
    return {
      // Se apaga en el último cuarto, no de golpe.
      opacity: t < 0.72 ? 1 : (1 - t) / 0.28,
      transform: [
        { translateX: Math.cos(ang) * fuerza * t },
        // Impulso hacia arriba menos gravedad: sube y luego cae.
        { translateY: Math.sin(ang) * fuerza * t + 190 * t * t },
        { rotate: `${giro * t}deg` },
        { scale: 1 - t * 0.35 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.cubo,
        {
          width: lado,
          height: lado,
          marginLeft: -lado / 2,
          marginTop: -lado / 2,
          backgroundColor: tinte,
        },
        anim,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  // 1x1 y no 0x0: en Android una vista sin area puede no dibujar sus
  // hijos absolutos, y un pixel no se ve.
  origen: { position: 'absolute', width: 1, height: 1 },
  cubo: { position: 'absolute', borderRadius: 2 },
});
