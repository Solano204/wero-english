import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { color, iconoRedondo, iconoVisual, shadow } from '@/theme';
import * as haptics from '@/services/haptics';
import { Icon, type IconName } from './Icon';
import { Presionable } from './Presionable';

type Tamano = keyof typeof iconoRedondo;
type Tono = 'claro' | 'acento' | 'contraste';

interface Props {
  icono: IconName;
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
  icono,
  etiqueta,
  onPress,
  tamano = 'md',
  tono = 'claro',
  disabled = false,
  style,
}: Props) {
  const toque = iconoRedondo[tamano];
  const lado = iconoVisual[tamano];

  return (
    <Presionable
      onPress={() => {
        haptics.tapLight();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled }}
      // El Pressable mide lo que se toca (48 o más) y el círculo lo que se
      // ve: un objetivo más chico que 48 se falla y la culpa se la lleva la
      // app. Sin hitSlop, que se solapa con los vecinos.
      style={[
        styles.centrado,
        { width: toque, height: toque },
        disabled && styles.apagado,
        style,
      ]}
    >
      <View
        style={[
          styles.centrado,
          { width: lado, height: lado, borderRadius: lado / 2 },
          tonos[tono],
        ]}
      >
        <Icon name={icono} size="lg" color={colores[tono]} />
      </View>
    </Presionable>
  );
}

const tonos: Record<Tono, ViewStyle> = {
  claro: { backgroundColor: color.surface, ...shadow.soft },
  acento: { backgroundColor: color.primario, ...shadow.soft },
  contraste: { backgroundColor: color.contraste, ...shadow.soft },
};

const colores: Record<Tono, string> = {
  claro: color.text,
  acento: color.onPrimario,
  contraste: color.onContraste,
};

const styles = StyleSheet.create({
  centrado: { alignItems: 'center', justifyContent: 'center' },
  apagado: { opacity: 0.4 },
});
