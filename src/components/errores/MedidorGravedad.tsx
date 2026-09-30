import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { anuncioGravedad, etiquetaGravedad } from '@/domain/errores';
import { color, escalon, font, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';

const BARRAS = [1, 2, 3] as const;
const ANCHO_BARRA = 6;
/** Alto de la barra más baja y cuánto crece cada una, en dp: suben como las rayitas de una señal. */
const ALTO_BASE = 8;
const ALTO_PASO = 4;
const RADIO_BARRA = 2;

interface BarraProps {
  numero: 1 | 2 | 3;
  encendida: boolean;
  animada: boolean;
  retraso: number;
}

function Barra({ numero, encendida, animada, retraso }: BarraProps) {
  const reducido = useMovimientoReducido();
  const luz = useSharedValue(animada && !reducido ? 0 : encendida ? 1 : 0);

  useEffect(() => {
    if (!animada || reducido) {
      luz.value = encendida ? 1 : 0;
      return;
    }
    luz.value = encendida
      ? withDelay(retraso + escalon(numero - 1), withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }))
      : 0;
    return () => cancelAnimation(luz);
  }, [animada, reducido, encendida, retraso, numero, luz]);

  const estilo = useAnimatedStyle(() => ({ opacity: luz.value }));
  return (
    <View style={[styles.barra, { height: ALTO_BASE + ALTO_PASO * (numero - 1) }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.encendida, estilo]} />
    </View>
  );
}

interface Props {
  gravedad: 1 | 2 | 3;
  /** `columna`: las barras y debajo la etiqueta (la lista). `fila`: la etiqueta al lado (el detalle). */
  disposicion?: 'columna' | 'fila';
  /** Las barras se encienden una tras otra al montarse (una sola vez). */
  animado?: boolean;
  /** Espera antes de encenderse (ms), para acompañar una secuencia. */
  retraso?: number;
}

/**
 * La gravedad de un error: tres barras que suben, de 1 a 3 encendidas en `wrong` (ámbar, nunca rojo), y su etiqueta en
 * texto («Suena raro», «Te delata», «Cambia el significado»). Nada se comunica solo con las barras: el lector de pantalla
 * oye «Gravedad: Te delata, 2 de 3». Con «reducir movimiento» las barras ya están encendidas.
 */
export function MedidorGravedad({ gravedad, disposicion = 'columna', animado = false, retraso = 0 }: Props) {
  return (
    <View
      style={disposicion === 'columna' ? styles.columna : styles.fila}
      accessible
      accessibilityLabel={anuncioGravedad(gravedad)}
    >
      <View style={styles.barras} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {BARRAS.map((n) => (
          <Barra key={n} numero={n} encendida={n <= gravedad} animada={animado} retraso={retraso} />
        ))}
      </View>
      <Text
        style={[styles.etiqueta, disposicion === 'columna' && styles.etiquetaColumna]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {etiquetaGravedad(gravedad)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  columna: { alignItems: 'flex-end', gap: space.xs, width: 88 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  barra: { width: ANCHO_BARRA, borderRadius: RADIO_BARRA, backgroundColor: color.borderStrong, overflow: 'hidden' },
  encendida: { backgroundColor: color.wrong },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.textMuted },
  etiquetaColumna: { textAlign: 'right' },
});
