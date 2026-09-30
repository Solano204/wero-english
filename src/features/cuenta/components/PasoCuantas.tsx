import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Card, Presionable } from '@/shared/ui';
import { NOTIF_MAX_POR_DIA } from '@/data/repos/ajustes';
import { aparecer, color, font, layout, radius, space } from '@/theme';

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
}: {
  valor: number;
  onChange: (n: number) => void;
  desde: string;
  hasta: string;
  onVentana: (desde: string, hasta: string) => void;
  onSiguiente: () => void;
}) {
  const opciones = [0, 2, 4, 6, 8, 12].filter((n) => n <= NOTIF_MAX_POR_DIA);
  const ventanas: { label: string; desde: string; hasta: string }[] = [
    { label: 'Todo el día', desde: '09:00', hasta: '21:00' },
    { label: 'Solo en la mañana', desde: '08:00', hasta: '13:00' },
    { label: 'Solo en la tarde', desde: '15:00', hasta: '21:00' },
  ];

  return (
    <Animated.View entering={aparecer()} style={styles.paso}>
      <Text style={styles.titulo}>Recibe frases todo el día</Text>
      <Text style={styles.bajada}>
        Cada aviso es una sola frase
      </Text>

      <Card style={styles.previa}>
        <Text style={styles.previaApp}>Wero · ahora</Text>
        <Text style={styles.previaTexto}>
          ¿Sabes qué significa Out of pocket?
        </Text>
      </Card>

      <Text style={styles.etiqueta}>Cuántas al día</Text>
      <View style={styles.chips}>
        {opciones.map((n) => (
          <Presionable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityLabel={`${n} al día`}
            style={[styles.chip, valor === n && styles.chipOn]}
          >
            <Text style={[styles.chipTexto, valor === n && styles.chipTextoOn]}>
              {n === 0 ? 'ninguna' : n}
            </Text>
          </Presionable>
        ))}
      </View>

      {valor > 0 ? (
        <>
          <Text style={styles.etiqueta}>A qué horas</Text>
          <View style={styles.chips}>
            {ventanas.map((v) => {
              const activa = v.desde === desde && v.hasta === hasta;
              return (
                <Presionable
                  key={v.label}
                  onPress={() => onVentana(v.desde, v.hasta)}
                  accessibilityRole="button"
                  accessibilityLabel={v.label}
                  style={[styles.chip, activa && styles.chipOn]}
                >
                  <Text
                    style={[styles.chipTexto, activa && styles.chipTextoOn]}
                  >
                    {v.label}
                  </Text>
                </Presionable>
              );
            })}
          </View>
        </>
      ) : null}

      <Button label="Siguiente" onPress={onSiguiente} full />
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
