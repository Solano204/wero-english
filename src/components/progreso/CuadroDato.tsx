import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon, type IconName } from '@/shared/ui';
import { color, font, radius, space, text } from '@/theme';

interface Props {
  etiqueta: string;
  /** El número manda: `h1`, Bricolage, cifras tabulares. */
  valor?: string;
  /** Va junto al número, en `sm` muted (p. ej. «días»). */
  unidad?: string;
  icono?: IconName;
  iconoColor?: string;
  /** Un punto de color en vez de ícono (p. ej. el ámbar de «Se te atoran»). */
  punto?: string;
  /** Reemplaza el ícono y el número (p. ej. el anillo de la precisión). */
  medidor?: ReactNode;
  /** Si viene, toda la ficha es tocable. */
  onPress?: () => void;
  /** Lo que lee el lector de pantalla: el dato completo en una frase. */
  accessibilityLabel: string;
}

/**
 * Una ficha del «Detalle»: el número grande arriba y su etiqueta `sm` muted debajo, con
 * un ícono, un punto o un medidor. Las cuatro se ven como una cuadrícula con jerarquía y
 * no como cuatro tarjetas iguales.
 */
export function CuadroDato({
  etiqueta,
  valor,
  unidad,
  icono,
  iconoColor,
  punto,
  medidor,
  onPress,
  accessibilityLabel,
}: Props) {
  const contenido = (
    <>
      {medidor ?? (
        <>
          {icono ? (
            <Icon name={icono} size="lg" color={iconoColor ?? color.textMuted} />
          ) : punto ? (
            <View style={[styles.punto, { backgroundColor: punto }]} />
          ) : null}
          <View style={styles.valor}>
            <Text style={styles.numero}>{valor}</Text>
            {unidad ? <Text style={styles.unidad}>{unidad}</Text> : null}
          </View>
        </>
      )}
      <Text style={styles.etiqueta}>{etiqueta}</Text>
    </>
  );

  return (
    <Card onPress={onPress} accessibilityLabel={accessibilityLabel} style={styles.cuadro}>
      {onPress ? (
        contenido
      ) : (
        <View accessible accessibilityLabel={accessibilityLabel} style={styles.interior}>
          {contenido}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  cuadro: { flex: 1 },
  interior: { gap: space.md },
  punto: { width: 8, height: 8, borderRadius: radius.pill },
  valor: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  numero: { ...text.h1, fontVariant: ['tabular-nums'] },
  unidad: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  etiqueta: { fontFamily: font.family.body, fontSize: font.size.sm, lineHeight: font.size.sm * 1.45, color: color.textMuted },
});
