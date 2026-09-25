import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  color,
  filoOk,
  filoWrong,
  font,
  layout,
  motionDuration,
  motionEasing,
  motionSpring,
  radius,
  sol,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { Icon } from '@/components/base/Icon';
import { Presionable } from '@/components/base/Presionable';
import type { Rect } from '@/components/fx';

export type OptionState = 'idle' | 'chosen' | 'correct' | 'wrong' | 'dimmed';

interface Props {
  label: string;
  state: OptionState;
  onPress: () => void;
  disabled?: boolean;
  index: number;
  /** Teléfono chico: opción de 52 dp en vez de 56, para que las cuatro quepan sin scroll. */
  compacta?: boolean;
  /** Al tocarla, mide dónde está en la ventana (para que salgan cubitos o vuele la palabra desde ella). */
  alMedir?: (rect: Rect) => void;
  /** La palabra ya salió de aquí (voló al hueco de la frase): el texto se va y queda el veredicto. */
  vaciada?: boolean;
}

/** Grosor del filo de luz del veredicto. */
const FILO = 1;
/** Hueco fijo a la derecha para la marca de acierto o de fallo: así el texto no se reacomoda al aparecer. */
const HUECO_MARCA = 20;

/**
 * Opción de respuesta.
 *
 * Entra escalonada por índice, así el ojo baja en orden. El veredicto se da EN la
 * opción, sin velo encima: la correcta se enciende en verde con una marca de
 * palomita y un pulso; la que elegiste mal se sacude en ámbar con una equis
 * (movimiento y símbolo, no solo color) mientras la correcta se enciende al
 * mismo tiempo; las demás bajan a 0.45.
 */
export function OptionButton({
  label,
  state,
  onPress,
  disabled,
  index,
  compacta = false,
  alMedir,
  vaciada = false,
}: Props) {
  const enter = useSharedValue(0);
  const veredicto = useSharedValue(0);
  const marca = useSharedValue(0);
  const reducido = useMovimientoReducido();
  const raiz = useRef<View>(null);
  const conVeredicto = state === 'correct' || state === 'wrong';

  useEffect(() => {
    enter.value = reducido
      ? withTiming(1, { duration: 0 })
      : withDelay(
          index * 30,
          withTiming(1, {
            duration: motionDuration.base,
            easing: motionEasing.entrar,
          })
        );
  }, [enter, reducido, index]);

  useEffect(() => {
    if (!conVeredicto) {
      veredicto.value = 0;
      marca.value = 0;
      return;
    }
    veredicto.value = reducido ? 1 : withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
    marca.value = reducido ? 1 : withSpring(1, motionSpring.rebote);
  }, [conVeredicto, reducido, veredicto, marca]);

  const anim = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }],
  }));
  const luz = useAnimatedStyle(() => ({ opacity: veredicto.value }));
  const simbolo = useAnimatedStyle(() => ({
    opacity: veredicto.value,
    transform: [{ scale: 0.4 + 0.6 * marca.value }],
  }));

  const alTocar = () => {
    raiz.current?.measureInWindow((x, y, width, height) => alMedir?.({ x, y, width, height }));
    onPress();
  };

  const etiqueta =
    state === 'correct' ? `${label}. Correcta` : state === 'wrong' ? `${label}. No era esta` : label;

  return (
    <Presionable
      onPress={alTocar}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled, selected: state === 'chosen' || state === 'wrong' }}
      resultado={state === 'correct' ? 'acierto' : state === 'wrong' ? 'fallo' : null}
      style={{ zIndex: 10 - index }}
    >
      <Animated.View
        ref={raiz}
        collapsable={false}
        style={[styles.contenedor, state === 'dimmed' && styles.atenuada, anim]}
      >
        {/* El filo de luz del veredicto: un degradado de 1 px que se enciende. */}
        {conVeredicto ? (
          <Animated.View style={[StyleSheet.absoluteFill, styles.filo, luz]} pointerEvents="none">
            <LinearGradient
              colors={state === 'correct' ? filoOk : filoWrong}
              start={sol.start}
              end={sol.end}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        <View
          style={[
            styles.base,
            compacta && styles.baseCompacta,
            state === 'chosen' && styles.elegida,
          ]}
        >
          {conVeredicto ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: state === 'correct' ? color.correctFondo : color.wrongFondo },
                luz,
              ]}
              pointerEvents="none"
            />
          ) : null}
          <Text
            style={[
              styles.label,
              conVeredicto && (state === 'correct' ? styles.textoOk : styles.textoMal),
              state === 'dimmed' && styles.textoAtenuado,
              vaciada && styles.vaciada,
            ]}
          >
            {label}
          </Text>
          <Animated.View style={[styles.marca, simbolo]} pointerEvents="none">
            {state === 'correct' ? <Icon name="check" size="md" color={color.correct} /> : null}
            {state === 'wrong' ? <Icon name="close" size="md" color={color.wrong} /> : null}
          </Animated.View>
        </View>
      </Animated.View>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  contenedor: { borderRadius: radius.md },
  atenuada: { opacity: 0.45 },
  filo: { borderRadius: radius.md, overflow: 'hidden' },
  // Sin borde en reposo: la opción se separa del fondo por su superficie, no por un
  // contorno (con cuatro en pantalla los contornos se leían como una reja). El margen de
  // 1 px es donde asoma el filo cuando llega el veredicto.
  base: {
    margin: FILO,
    minHeight: layout.tapMin + 8 - FILO * 2,
    borderRadius: radius.md - FILO,
    overflow: 'hidden',
    backgroundColor: color.surface,
    paddingLeft: space.lg,
    paddingRight: space.lg + HUECO_MARCA,
    paddingVertical: space.md,
    justifyContent: 'center',
  },
  baseCompacta: { minHeight: layout.tapMin + 4 - FILO * 2, paddingVertical: space.sm },
  elegida: { backgroundColor: color.surfaceHigh },
  label: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.4,
    color: color.text,
  },
  textoOk: { color: color.correct, fontFamily: font.family.bodyStrong },
  textoMal: { color: color.wrong, fontFamily: font.family.bodyStrong },
  textoAtenuado: { color: color.textMuted },
  vaciada: { opacity: 0 },
  marca: {
    position: 'absolute',
    right: space.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
