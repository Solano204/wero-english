import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/base/Icon';
import { color, font, motionDuration, radius, space, aparecerZoom, desaparecer } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { Marcador } from './Marcador';

interface Props {
  valor: number;
  /** Texto visible después del número. Sin él, el chip es solo icono y cifra. */
  sufijo?: string;
  icono?: IconName;
  tinte: string;
  /** Lo que lee el lector de pantalla: la frase completa, no la cifra suelta. */
  etiqueta: string;
}

/**
 * Chip de la sesión: una cifra que rueda (Marcador) con su nombre al lado.
 * Quien lo usa decide cuándo existe; al aparecer entra creciendo y al irse
 * se desvanece. Con movimiento reducido solo está o no está.
 */
export function ChipMarcador({ valor, sufijo, icono, tinte, etiqueta }: Props) {
  const reducido = useMovimientoReducido();
  return (
    <Animated.View
      entering={reducido ? undefined : aparecerZoom()}
      exiting={reducido ? undefined : desaparecer(motionDuration.rapido)}
      style={styles.pastilla}
      accessible
      accessibilityRole="text"
      accessibilityLabel={etiqueta}
    >
      {icono ? <Icon name={icono} size="sm" color={tinte} /> : null}
      <Marcador valor={valor} tamano={font.size.sm} color={tinte} etiqueta={etiqueta} />
      {sufijo ? <Text style={styles.sufijo}>{sufijo}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // No se toca: es solo lectura, por eso mide menos de 48 dp.
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 28,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  sufijo: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted },
});
