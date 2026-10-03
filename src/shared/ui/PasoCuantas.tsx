import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Presionable } from './Presionable';
import { NOTIF_MAX_POR_DIA } from '@/config/notificaciones';
import { VENTANAS_AVISO } from '@/domain/perfilInicial';
import { color, font, layout, radius, space } from '@/theme';

/**
 * El paso de las notificaciones.
 *
 * El deslizador arranca en cuatro y no en cero. Cero sería lo honesto y
 * también significaría que nadie recibe nunca nada, que es la forma más
 * rápida de matar la retención del día siete. Diez, como la
 * competencia, ya se siente encima. Cuatro es el punto donde hace
 * hábito sin molestar.
 */
export function PasoCuantas({
  valor,
  onChange,
  desde,
  hasta,
  onVentana,
  onSiguiente,
  textoBoton = 'Siguiente',
}: {
  valor: number;
  onChange: (n: number) => void;
  desde: string;
  hasta: string;
  onVentana: (desde: string, hasta: string) => void;
  onSiguiente: () => void;
  textoBoton?: string;
}) {
  const opciones = [0, 2, 4, 6, 8, 12].filter((n) => n <= NOTIF_MAX_POR_DIA);

  return (
    <View style={styles.paso}>
      <Text style={styles.titulo} accessibilityRole="header">
        Recibe frases todo el día
      </Text>
      <Text style={styles.bajada}>Cada aviso es una sola frase</Text>

      <Card style={styles.previa}>
        <Text style={styles.previaApp}>Wero · ahora</Text>
        <Text style={styles.previaTexto}>¿Sabes qué significa Out of pocket?</Text>
      </Card>

      <Text style={styles.etiqueta}>Cuántas al día</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {opciones.map((n) => (
          <Presionable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="radio"
            accessibilityLabel={n === 0 ? 'Ninguna al día' : `${n} al día`}
            accessibilityState={{ selected: valor === n, checked: valor === n }}
            style={[styles.chip, valor === n && styles.chipOn]}
          >
            <Text style={[styles.chipTexto, valor === n && styles.chipTextoOn]}>{n === 0 ? 'ninguna' : n}</Text>
          </Presionable>
        ))}
      </View>

      {valor > 0 ? (
        <>
          <Text style={styles.etiqueta}>A qué horas</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {VENTANAS_AVISO.map((v) => {
              const activa = v.desde === desde && v.hasta === hasta;
              return (
                <Presionable
                  key={v.label}
                  onPress={() => onVentana(v.desde, v.hasta)}
                  accessibilityRole="radio"
                  accessibilityLabel={v.label}
                  accessibilityState={{ selected: activa, checked: activa }}
                  style={[styles.chip, activa && styles.chipOn]}
                >
                  <Text style={[styles.chipTexto, activa && styles.chipTextoOn]}>{v.label}</Text>
                </Presionable>
              );
            })}
          </View>
        </>
      ) : null}

      <Button label={textoBoton} onPress={onSiguiente} full />
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
  previa: { gap: space.xs, backgroundColor: color.surfaceAlt },
  previaApp: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  previaTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  etiqueta: {
    fontSize: font.size.xs,
    color: color.textFaint,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: font.family.bodyStrong,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  chipTexto: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  chipTextoOn: { color: color.accent, fontFamily: font.family.bodyStrong },
});
