import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/components/base';
import { QUITAR, amortiguarQuitar, avanceQuitar, decidirQuitar } from '@/domain/guardadas';
import { color, font, motionDuration, motionEasing, motionSpring, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';

/** Lo que sale de más una tarjeta que se va, en dp, para que quede del todo fuera de la pantalla. */
const SALIDA_EXTRA = 96;

interface Props {
  children: ReactNode;
  /** La tarjeta salió: hay que quitarla de la lista. */
  onQuitar: () => void;
}

/**
 * Deslizar una tarjeta a la izquierda revela «Quitar» (la estrella en contorno) detrás de ella. Si se suelta pasado el
 * umbral (96 dp o 800 dp/s) la tarjeta se va y avisa con `onQuitar`; si no, regresa con resorte. A la derecha apenas cede.
 * El gesto solo se activa con el dedo moviéndose de lado y cede ante el scroll vertical de la lista. Corre en el hilo de UI.
 * Con «reducir movimiento» no hay deslizamiento: solo el contenido (quitar se hace con el botón que sale al mantener
 * presionado o con la acción del lector de pantalla). El deslizamiento nunca es la única forma de quitar.
 */
export function DeslizarQuitar({ children, onQuitar }: Props) {
  const reducido = useMovimientoReducido();
  const { width } = useWindowDimensions();
  const tx = useSharedValue(0);
  const saliendo = useSharedValue(0);

  // El aviso va por una referencia: el gesto no se rearma cada vez que la pantalla cambia de lista.
  const alQuitar = useRef(onQuitar);
  alQuitar.current = onQuitar;
  const avisar = useCallback(() => alQuitar.current(), []);

  useEffect(() => () => cancelAnimation(tx), [tx]);

  const gesto = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-QUITAR.activa, QUITAR.activa])
        .failOffsetY([-QUITAR.falla, QUITAR.falla])
        .onUpdate((e) => {
          if (saliendo.value === 1) return;
          tx.value = amortiguarQuitar(e.translationX);
        })
        .onEnd((e) => {
          if (saliendo.value === 1) return;
          if (decidirQuitar(tx.value, e.velocityX) === 'quitar') {
            saliendo.value = 1;
            tx.value = withTiming(-(width + SALIDA_EXTRA), { duration: motionDuration.base, easing: motionEasing.salir }, (fin) => {
              'worklet';
              if (fin) runOnJS(avisar)();
            });
            return;
          }
          tx.value = withSpring(0, motionSpring.rebote);
        })
        .onFinalize((_, exito) => {
          // Un gesto interrumpido no deja la tarjeta a medio camino.
          if (!exito && saliendo.value === 0) tx.value = withSpring(0, motionSpring.rebote);
        }),
    [tx, saliendo, width, avisar]
  );

  const estiloTarjeta = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const estiloAccion = useAnimatedStyle(() => {
    const a = avanceQuitar(tx.value);
    return { opacity: Math.min(1, a * 2), transform: [{ scale: 0.9 + 0.1 * a }] };
  });

  if (reducido) return <>{children}</>;
  return (
    <View>
      <View style={styles.detras} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.accion, estiloAccion]}>
          <Icon name="star" size="md" color={color.wrong} />
          <Text style={styles.etiqueta}>Quitar</Text>
        </Animated.View>
      </View>
      <GestureDetector gesture={gesto}>
        <Animated.View style={estiloTarjeta}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  // El fondo que deja ver la tarjeta al correrse: del tamaño de ella, con su misma esquina.
  detras: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.wrongSoft,
  },
  accion: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.wrong },
});
