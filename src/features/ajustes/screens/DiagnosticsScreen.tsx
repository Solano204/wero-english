import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Carga, Header, Icon, Screen } from '@/shared/ui';
import { BUNDLED_COUNT } from '@/services/media';
import { color, font, space } from '@/theme';
import { useDiagnostico } from '@/features/ajustes/hooks/useDiagnostico';

/**
 * Diagnóstico de datos.
 *
 * Dice exactamente qué JSON está vacío. Sin esto, una app sin contenido
 * se ve igual que una app rota, y no hay forma de saber cuál es.
 */
export function DiagnosticsScreen() {
  const { nav, health, carga } = useDiagnostico();

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title="Diagnóstico" />

      <Text style={styles.intro}>
        Estado de los archivos de assets/data. Si alguno sale en rojo,
        pega su contenido y recarga la app.
      </Text>

      <View style={styles.list}>
        {health.map((h) => (
          <Card key={h.name} style={styles.row}>
            <Icon name={h.ok ? 'check' : 'warning'} size="md" color={h.ok ? color.correct : color.wrong} />
            <Text style={styles.name}>{h.name}</Text>
            <Text style={styles.count}>{h.count}</Text>
          </Card>
        ))}
      </View>

      <Carga carga={carga}>
        {({ enDb, mb, cola }) => (
          <Card style={styles.summary}>
            <Line label="Entradas en la base" value={String(enDb)} />
            <Line label="Medios en el binario" value={String(BUNDLED_COUNT)} />
            <Line label="Medios descargados" value={`${mb.toFixed(1)} MB`} />
            <Line
              label="Cola de repaso: vencidas / de aprendizaje / fantasma"
              value={cola ? `${cola.vencidas} / ${cola.aprendizaje} / ${cola.fantasma}` : '…'}
            />
          </Card>
        )}
      </Carga>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.6,
    marginBottom: space.lg,
  },
  list: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  name: { flex: 1, fontFamily: font.family.body, fontSize: font.size.sm, color: color.text },
  count: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  summary: { marginTop: space.lg, gap: space.sm },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: { flex: 1, fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  lineValue: {
    fontSize: font.size.sm,
    color: color.text,
    fontFamily: font.family.bodyStrong,
  },
});
