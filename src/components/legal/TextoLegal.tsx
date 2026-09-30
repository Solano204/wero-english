import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { Bloque, Parte } from '@/legal/tipos';
import { color, font, radius, space } from '@/theme';

/** Los trozos de un párrafo: negrita, cursiva y enlaces (los enlaces abren el navegador; el texto se lee sin internet). */
function Partes({ partes }: { partes: Parte[] }) {
  return (
    <>
      {partes.map((p, i) => (
        <Text
          key={i}
          style={[p.negrita && styles.negrita, p.cursiva && styles.cursiva, p.url ? styles.enlace : null]}
          onPress={p.url ? () => void Linking.openURL(p.url as string) : undefined}
          accessibilityRole={p.url ? 'link' : undefined}
        >
          {p.texto}
        </Text>
      ))}
    </>
  );
}

/**
 * Un texto legal empaquetado (src/legal/textos.ts): subtítulos, párrafos y listas en el cuerpo de
 * la app (16 px, interlineado 1.5). Los subtítulos son encabezados para el lector de pantalla.
 */
export function TextoLegal({ bloques }: { bloques: Bloque[] }) {
  return (
    <View style={styles.raiz}>
      {bloques.map((b, i) => {
        if (b.t === 'h2' || b.t === 'h3') {
          return (
            <Text key={i} style={b.t === 'h2' ? styles.h2 : styles.h3} accessibilityRole="header">
              <Partes partes={b.partes} />
            </Text>
          );
        }
        if (b.t === 'li' || b.t === 'ol') {
          return (
            <View key={i} style={styles.renglon}>
              {b.t === 'li' ? (
                <View style={styles.punto} />
              ) : (
                <Text style={[styles.cuerpo, styles.numero]}>{b.n}.</Text>
              )}
              <Text style={[styles.cuerpo, styles.flex]}>
                <Partes partes={b.partes} />
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.cuerpo}>
            <Partes partes={b.partes} />
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: space.md },
  h2: { fontFamily: font.family.heading, fontSize: font.size.lg, color: color.text, marginTop: space.md },
  h3: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text, marginTop: space.sm },
  cuerpo: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.text },
  negrita: { fontFamily: font.family.bodyStrong },
  cursiva: { fontStyle: 'italic' },
  enlace: { color: color.accent, textDecorationLine: 'underline' },
  renglon: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  punto: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.accent, marginTop: space.sm },
  numero: { minWidth: 20, color: color.textMuted },
  flex: { flex: 1 },
});
