import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button } from '@/shared/ui';
import { color, font, layout, motionDuration, motionEasing, reflejo, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** Alto del pie: el del botón grande, para que no cambie de tamaño al revisar. */
const ALTO_PIE = 58;
/** Cuánto ocupa el reflejo respecto del botón. */
const ANCHO_REFLEJO = 0.4;

/** El reflejo que cruza «Revisar» una sola vez cuando pasa de bloqueado a activo. */
function Destello({ activo }: { activo: boolean }) {
  const reducido = useMovimientoReducido();
  const barrido = useSharedValue(1);
  const ancho = useSharedValue(0);
  const previo = useRef(activo);

  useEffect(() => {
    if (activo && !previo.current && !reducido) {
      barrido.value = 0;
      barrido.value = withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar });
    }
    previo.current = activo;
  }, [activo, reducido, barrido]);

  const estilo = useAnimatedStyle(() => ({
    opacity: barrido.value >= 1 ? 0 : 1,
    transform: [{ translateX: interpolate(barrido.value, [0, 1], [-ancho.value * 0.5, ancho.value * 1.1], Extrapolation.CLAMP) }],
  }));

  if (reducido) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        ancho.value = e.nativeEvent.layout.width;
      }}
    >
      <Animated.View style={[styles.reflejo, estilo]}>
        <LinearGradient colors={reflejo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

interface Props {
  /** Cuántas reducciones lleva marcadas (0 a 3). */
  marcadas: number;
  /** Ya se revisó la ronda: el pie pasa de «Revisar» a «Siguiente». */
  revisada: boolean;
  /** Es la última ronda: «Terminar» en lugar de «Siguiente». */
  ultima: boolean;
  /** Teléfono de poco alto: botones de 48 en lugar de 58. */
  compacta: boolean;
  /** Se acaba de tocar «Siguiente»: espera para no procesar dos toques. */
  esperando: boolean;
  onRevisar: () => void;
  onSiguiente: () => void;
}

/**
 * El pie fijo de Cázala, siempre del mismo alto. Antes de revisar: «N de 3 marcadas» y «Revisar», bloqueado hasta
 * marcar tres, con un reflejo al activarse. Después: «Siguiente» (o «Terminar» en la última ronda), a todo lo ancho.
 */
export function PieCaza({ marcadas, revisada, ultima, compacta, esperando, onRevisar, onSiguiente }: Props) {
  const size = compacta ? 'md' : 'lg';
  return (
    <View style={[styles.pie, { minHeight: compacta ? layout.tapMin : ALTO_PIE }]}>
      {revisada ? (
        <Button
          label={ultima ? 'Terminar' : 'Siguiente'}
          icon={ultima ? 'check' : 'arrow-right'}
          iconAlFinal={!ultima}
          size={size}
          full
          disabled={esperando}
          onPress={onSiguiente}
        />
      ) : (
        <View style={styles.fila}>
          <Text style={styles.contador}>{marcadas} de 3 marcadas</Text>
          <Button
            label="Revisar"
            size={size}
            disabled={marcadas !== 3}
            fondo={<Destello activo={marcadas === 3} />}
            onPress={onRevisar}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pie: { justifyContent: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  contador: { flex: 1, fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  reflejo: { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${ANCHO_REFLEJO * 100}%` },
});
