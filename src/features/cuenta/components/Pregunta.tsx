import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Presionable } from '@/shared/ui';
import { aparecer, color, font, radius, space } from '@/theme';

export interface Opcion {
  label: string;
  valor: unknown;
}

export function Pregunta({
  titulo,
  bajada,
  opciones,
  onPick,
  nota,
}: {
  titulo: string;
  bajada: string;
  opciones: Opcion[];
  onPick: (valor: unknown) => void;
  nota?: string;
}) {
  return (
    <Animated.View entering={aparecer()} style={styles.paso}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.bajada}>{bajada}</Text>

      <View style={styles.opciones}>
        {opciones.map((o) => (
          <Presionable
            key={o.label}
            onPress={() => onPick(o.valor)}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            style={styles.opcion}
          >
            <Text style={styles.opcionTexto}>{o.label}</Text>
          </Presionable>
        ))}
      </View>

      {nota ? <Text style={styles.nota}>{nota}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  paso: { gap: space.md },
  titulo: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
  },
  bajada: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  opciones: { gap: space.sm, marginTop: space.md },
  opcion: {
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
  },
  opcionTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  nota: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
});
