import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Presionable } from './Presionable';
import { color, font, radius, space } from '@/theme';

export interface Opcion {
  label: string;
  valor: unknown;
}

/**
 * Una pregunta con opciones de una sola respuesta. Elegir no avanza: marca la opción (se puede cambiar) y
 * «Siguiente» se activa cuando hay respuesta. Con una respuesta que ya existía, llega marcada.
 */
export function PreguntaPerfil({
  titulo,
  bajada,
  opciones,
  valor,
  onElegir,
  onSiguiente,
  textoBoton = 'Siguiente',
  nota,
}: {
  titulo: string;
  bajada: string;
  opciones: Opcion[];
  /** La respuesta actual, o null/undefined si todavía no hay. */
  valor?: unknown;
  onElegir: (valor: unknown) => void;
  onSiguiente: () => void;
  textoBoton?: string;
  nota?: string;
}) {
  const hayRespuesta = valor !== null && valor !== undefined;
  return (
    <View style={styles.paso}>
      <Text style={styles.titulo} accessibilityRole="header">
        {titulo}
      </Text>
      <Text style={styles.bajada}>{bajada}</Text>

      <View style={styles.opciones} accessibilityRole="radiogroup">
        {opciones.map((o) => {
          const activa = hayRespuesta && o.valor === valor;
          return (
            <Presionable
              key={o.label}
              onPress={() => onElegir(o.valor)}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: activa, checked: activa }}
              style={[styles.opcion, activa && styles.opcionOn]}
            >
              <Text style={[styles.opcionTexto, activa && styles.opcionTextoOn]}>{o.label}</Text>
            </Presionable>
          );
        })}
      </View>

      {nota ? <Text style={styles.nota}>{nota}</Text> : null}

      <Button label={textoBoton} onPress={onSiguiente} disabled={!hayRespuesta} full />
    </View>
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
  opcionOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  opcionTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  opcionTextoOn: { fontFamily: font.family.bodyStrong },
  nota: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted },
});
