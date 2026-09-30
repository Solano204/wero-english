import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Presionable } from '@/shared/ui';
import { color, font, layout, radius, space } from '@/theme';

/** Los controles de las filas de Ajustes: interruptor, contador y fila de horas. */

export function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: color.surfaceHigh, true: color.accentSoft }}
        thumbColor={value ? color.accent : color.textFaint}
      />
    </View>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepperControls}>
        <Button
          label="−"
          variant="secondary"
          onPress={() => onChange(Math.max(min, value - step))}
          style={styles.stepBtn}
        />
        <Text style={styles.stepValue}>{value}</Text>
        <Button
          label="+"
          variant="secondary"
          onPress={() => onChange(Math.min(max, value + step))}
          style={styles.stepBtn}
        />
      </View>
    </View>
  );
}

/**
 * Fila de hora con opciones fijas en vez de un selector de reloj.
 *
 * Un time picker nativo abre un modal por cada extremo de la ventana y
 * pide dos toques más. Con cinco horas comunes se resuelve el 95% de
 * los casos en un toque, y quien quiera algo raro puede vivir con la
 * hora más cercana.
 */
export function HoraFila({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string;
  value: string;
  opciones: string[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.hora}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.horaChips}>
        {opciones.map((h) => (
          <Presionable
            key={h}
            onPress={() => onChange(h)}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${h}`}
            style={[styles.horaChip, value === h && styles.horaChipOn]}
          >
            <Text
              style={[styles.horaTexto, value === h && styles.horaTextoOn]}
            >
              {h}
            </Text>
          </Presionable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hora: { gap: space.sm },
  horaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  horaChip: {
    minHeight: layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
  },
  horaChipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  horaTexto: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  horaTextoOn: { color: color.accent, fontFamily: font.family.bodyStrong },
  label: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  hint: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted, marginTop: space.xs },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  toggleText: { flex: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { minWidth: 48 },
  stepValue: {
    fontSize: font.size.lg,
    color: color.text,
    fontFamily: font.family.heading,
    minWidth: 36,
    textAlign: 'center',
  },
});
