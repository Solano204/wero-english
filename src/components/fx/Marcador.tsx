import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { color as tinta, escalon, font, motionSpring } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';

/** Ancho de un dígito respecto de su tamaño: fijo, para que las cifras no bailen al rodar. */
const ANCHO_CIFRA = 0.62;
const ALTO_LINEA = 1.25;
const DIGITOS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

interface Props {
  valor: number;
  /** Tamaño de fuente (usa `font.size`). */
  tamano?: number;
  color?: string;
  /** Retraso (ms) antes de que ruede la primera cifra; las demás se escalonan de izquierda a derecha. */
  retraso?: number;
  /** Texto para el lector de pantalla. Sin él, el número. */
  etiqueta?: string;
}

interface ColumnaProps {
  digito: number;
  posicion: number;
  retraso: number;
  ancho: number;
  alto: number;
  tamano: number;
  color: string;
}

function Columna({ digito, posicion, retraso, ancho, alto, tamano, color }: ColumnaProps) {
  const reducido = useMovimientoReducido();
  const rodillo = useSharedValue(reducido ? digito : 0);

  useEffect(() => {
    rodillo.value = reducido ? digito : withDelay(retraso + escalon(posicion), withSpring(digito, motionSpring.rebote));
  }, [digito, posicion, retraso, reducido, rodillo]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(9, Math.max(0, rodillo.value)) * alto }],
  }));

  return (
    <View style={{ width: ancho, height: alto, overflow: 'hidden' }}>
      <Animated.View style={estilo}>
        {DIGITOS.map((d) => (
          <Text
            key={d}
            style={[styles.cifra, { width: ancho, height: alto, fontSize: tamano, lineHeight: alto, color }]}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * Marcador mecánico: cada dígito es una columna 0–9 que rueda hasta su valor
 * con un ligero rebote, escalonada de izquierda a derecha. Las columnas son
 * decorativas: el número real va en `accessibilityLabel`.
 */
export function Marcador({ valor, tamano = font.size.md, color = tinta.text, retraso = 0, etiqueta }: Props) {
  const digitos = String(Math.max(0, Math.floor(valor))).split('').map(Number);
  const ancho = Math.ceil(tamano * ANCHO_CIFRA);
  const alto = Math.round(tamano * ALTO_LINEA);
  return (
    <View
      style={styles.fila}
      accessible
      accessibilityRole="text"
      accessibilityLabel={etiqueta ?? String(Math.max(0, Math.floor(valor)))}
    >
      {digitos.map((d, i) => (
        // La llave cuenta desde la derecha: las unidades conservan su columna si el número crece.
        <Columna
          key={digitos.length - i}
          digito={d}
          posicion={i}
          retraso={retraso}
          ancho={ancho}
          alto={alto}
          tamano={tamano}
          color={color}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row' },
  cifra: {
    fontFamily: font.family.display,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    includeFontPadding: false,
  },
});
