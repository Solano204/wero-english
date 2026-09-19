import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { color, font, iconoRedondo, shadow } from '@/theme';
import * as haptics from '@/services/haptics';

type Tamano = keyof typeof iconoRedondo;
type Tono = 'claro' | 'acento' | 'contraste';

interface Props {
  /** Un símbolo corto: ←, →, ✕, ▶, ★. No una palabra. */
  simbolo: string;
  /** Lo que lee el lector de pantalla. Aquí sí va una frase. */
  etiqueta: string;
  onPress: () => void;
  tamano?: Tamano;
  tono?: Tono;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * Botón circular de icono.
 *
 * Es el patrón que se repite en la referencia: círculos claros con un
 * símbolo dentro, nunca un rectángulo con una palabra. Funciona porque
 * son acciones que se tocan decenas de veces al día y que a la tercera
 * ya nadie lee.
 *
 * El texto va en `etiqueta`, no en pantalla. Un botón sin texto visible
 * es invisible para un lector de pantalla si no se le dice qué hace, y
 * ese es el precio real de esta decisión estética.
 */
export function IconButton({
  simbolo,
  etiqueta,
  onPress,
  tamano = 'md',
  tono = 'claro',
  disabled = false,
  style,
}: Props) {
  const lado = iconoRedondo[tamano];

  return (
    <Pressable
      onPress={() => {
        haptics.tapLight();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled }}
      // El área táctil real es de 48 aunque el círculo mida 36: un
      // objetivo más chico que eso se falla y la culpa se la lleva la app.
      hitSlop={Math.max(0, Math.round((48 - lado) / 2))}
      style={({ pressed }) => [
        styles.base,
        { width: lado, height: lado, borderRadius: lado / 2 },
        tonos[tono],
        disabled && styles.apagado,
        pressed && styles.press,
        style,
      ]}
    >
      <Text style={[styles.simbolo, textos[tono], { fontSize: lado * 0.42 }]}>
        {simbolo}
      </Text>
    </Pressable>
  );
}

const tonos: Record<Tono, ViewStyle> = {
  claro: { backgroundColor: color.surface, ...shadow.soft },
  acento: { backgroundColor: color.accent, ...shadow.soft },
  contraste: { backgroundColor: color.contraste, ...shadow.soft },
};

const textos = StyleSheet.create({
  claro: { color: color.text },
  acento: { color: color.onAccent },
  contraste: { color: color.onContraste },
});

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  simbolo: { fontFamily: font.family.bodyStrong, lineHeight: undefined },
  apagado: { opacity: 0.4 },
  press: { opacity: 0.7, transform: [{ scale: 0.94 }] },
});
