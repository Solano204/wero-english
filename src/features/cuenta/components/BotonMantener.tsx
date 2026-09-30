import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Presionable } from '@/shared/ui/Presionable';
import * as haptics from '@/services/haptics';
import { color, font, motionConfirmar, motionDuration, motionEasing, radius, space } from '@/theme';
import { corrimientoRelleno, useAnchoRelleno } from '@/shared/ui/fx/rellenoBarra';

interface Props {
  /** Lo que dice el botón, p. ej. «Mantén presionado para borrar». */
  etiqueta: string;
  onConfirmar: () => void;
  cargando?: boolean;
  /** El diálogo que ve quien usa lector de pantalla (mantener presionado no es un gesto accesible). */
  dialogo: { titulo: string; mensaje: string; boton: string };
}

/**
 * La confirmación fuerte de lo que borra datos: hay que mantener presionado
 * `motionConfirmar.mantener` (2 s) mientras una barra se llena; soltar antes no hace nada y la
 * barra regresa. Con lector de pantalla, tocar abre un diálogo de confirmación normal. Alto de
 * 58 dp, como los botones grandes de la app.
 */
export function BotonMantener({ etiqueta, onConfirmar, cargando = false, dialogo }: Props) {
  const [lector, setLector] = useState(false);
  const progreso = useSharedValue(0);

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setLector);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setLector);
    return () => sub.remove();
  }, []);

  const confirmar = () => {
    haptics.tapMedium();
    onConfirmar();
  };

  const empezar = () => {
    if (lector || cargando) return;
    haptics.tapLight();
    progreso.set(withTiming(1, { duration: motionConfirmar.mantener, easing: motionEasing.lineal }, (completo) => {
      if (completo) runOnJS(confirmar)();
    }));
  };

  // Soltar antes de tiempo cancela: la animación termina sin completarse y nada se borra.
  const soltar = () => {
    cancelAnimation(progreso);
    progreso.set(withTiming(0, { duration: motionDuration.rapido }));
  };

  const conLector = () => {
    if (!lector || cargando) return;
    Alert.alert(dialogo.titulo, dialogo.mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: dialogo.boton, style: 'destructive', onPress: onConfirmar },
    ]);
  };

  const { ancho, alMedir } = useAnchoRelleno();
  const relleno = useAnimatedStyle(() => ({ transform: [{ translateX: corrimientoRelleno(progreso.get(), ancho.get()) }] }));

  return (
    <Presionable
      onPressIn={empezar}
      onPressOut={soltar}
      onPress={conLector}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={lector ? dialogo.boton : etiqueta}
      accessibilityHint={lector ? 'Abre una confirmación antes de borrar' : undefined}
      accessibilityState={{ disabled: cargando, busy: cargando }}
      style={styles.boton}
    >
      <Animated.View style={[styles.relleno, relleno]} onLayout={alMedir} pointerEvents="none" />
      <View style={styles.contenido} pointerEvents="none">
        {cargando ? <ActivityIndicator color={color.wrong} size="small" /> : null}
        <Text style={styles.texto}>{cargando ? 'Borrando…' : etiqueta}</Text>
      </View>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  boton: {
    minHeight: 58,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.wrong,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  relleno: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: color.wrongSoft },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  texto: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.wrong },
});
