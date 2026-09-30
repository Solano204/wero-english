import React, { useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Button } from '@/shared/ui';
import { color, motionEasing, motionSenal, reflejo } from '@/theme';
import { useReloj, useSenalActiva } from '@/shared/ui/fx/useSenalActiva';

/** Diámetro de la onda que sale del dedo: cubre el botón aunque se toque en una punta. */
const DIAMETRO_ONDA = 240;
/** Ancho del reflejo respecto del botón, y cuánto lo inclina la diagonal. */
const ANCHO_REFLEJO = 0.4;
const INCLINACION = '-20deg';

interface Props {
  label: string;
  onPress: () => void;
}

/**
 * El botón principal de HOY. Un reflejo metálico diagonal lo cruza cada 6 s y
 * al presionar sale una onda azul desde el punto del dedo, con háptico medio.
 * Con "reducir movimiento" no hay reflejo ni onda: queda el botón de siempre.
 */
export function BotonSenal({ label, onPress }: Props) {
  const { activo, reducido } = useSenalActiva();
  const fase = useReloj(motionSenal.reflejo, { activo, reducido });
  const ancho = useSharedValue(0);
  const dedoX = useSharedValue(0);
  const dedoY = useSharedValue(0);
  const onda = useSharedValue(0);
  const capa = useRef<View>(null);

  const estiloReflejo = useAnimatedStyle(() => {
    const paso = motionSenal.reflejoPaso / motionSenal.reflejo;
    return {
      transform: [
        { translateX: interpolate(fase.get(), [0, paso], [-ancho.get() * 0.5, ancho.get() * 1.1], Extrapolation.CLAMP) },
        { skewX: INCLINACION },
      ],
    };
  });

  const estiloOnda = useAnimatedStyle(() => ({
    opacity: (1 - onda.get()) * 0.55,
    transform: [
      { translateX: dedoX.get() - DIAMETRO_ONDA / 2 },
      { translateY: dedoY.get() - DIAMETRO_ONDA / 2 },
      { scale: onda.get() },
    ],
  }));

  const alPresionar = (e: GestureResponderEvent) => {
    if (reducido) return;
    const { pageX, pageY } = e.nativeEvent;
    // `locationX` es relativo al hijo tocado (el texto); la capa mide su propia posición en pantalla.
    capa.current?.measureInWindow((x, y) => {
      dedoX.set(pageX - x);
      dedoY.set(pageY - y);
      onda.set(0);
      onda.set(withTiming(1, { duration: motionSenal.onda, easing: motionEasing.entrar }));
    });
  };

  const fondo = (
    <View
      ref={capa}
      collapsable={false}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        ancho.set(e.nativeEvent.layout.width);
      }}
    >
      {reducido ? null : (
        <>
          <Animated.View style={[styles.reflejo, estiloReflejo]}>
            <LinearGradient
              colors={reflejo}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View style={[styles.onda, estiloOnda]} />
        </>
      )}
    </View>
  );

  return (
    <Button
      label={label}
      size="lg"
      full
      haptico="medio"
      fondo={fondo}
      onPressIn={alPresionar}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  reflejo: { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${ANCHO_REFLEJO * 100}%` },
  onda: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DIAMETRO_ONDA,
    height: DIAMETRO_ONDA,
    borderRadius: DIAMETRO_ONDA / 2,
    backgroundColor: color.accent50,
    opacity: 0,
  },
});
