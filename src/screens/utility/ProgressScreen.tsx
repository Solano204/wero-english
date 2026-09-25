import React from 'react';
import { conteo } from '@/utils/text';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Carga, ProgressBar, Screen, SkeletonLista } from '@/components/base';
import { SectionTitle } from '@/components/list';
import { getStats } from '@/db/queries';
import { getRecentDays } from '@/db/progress';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore } from '@/store';
import { color, font, radius, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * P-13, el progreso.
 *
 * La gráfica son barras dibujadas con Views, no una librería de charts.
 * Treinta rectángulos no justifican meter victory-native al bundle.
 */
export function ProgressScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const carga = useCarga(
    async () => {
      if (!user) return { stats: null, days: [] };
      const [stats, recientes] = await Promise.all([getStats(user.id), getRecentDays(user.id, 21)]);
      return { stats, days: [...recientes].reverse() };
    },
    [user],
    { alEnfocar: true }
  );
  const stats = carga.datos?.stats ?? null;
  const days = carga.datos?.days ?? [];

  const max = Math.max(1, ...days.map((d) => d.respuestas));

  /** Ventana fija de 21 días. Los días sin registro entran en cero. */
  const ventana = React.useMemo(() => {
    const porDia = new Map(days.map((d) => [d.dia, d.respuestas]));
    const hoy = new Date();
    const out: { dia: string; respuestas: number }[] = [];
    for (let i = 20; i >= 0; i--) {
      const f = new Date(hoy);
      f.setDate(hoy.getDate() - i);
      const clave = f.toISOString().slice(0, 10);
      out.push({ dia: clave, respuestas: porDia.get(clave) ?? 0 });
    }
    return out;
  }, [days]);

  if (carga.estado !== 'listo') {
    return (
      <Screen>
        <Text style={styles.title}>Tu progreso</Text>
        <Carga carga={carga} esqueleto={<SkeletonLista filas={3} alto={110} />}>
          {() => null}
        </Carga>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Tu progreso</Text>

      <Card style={styles.hero}>
        <View style={styles.heroRow}>
          <Big value={stats?.racha ?? 0} label="días seguidos" tint={color.accent} />
        </View>
        <View style={styles.overall}>
          <ProgressBar
            value={stats?.vistas ?? 0}
            total={Math.max(1, stats?.total ?? 1)}
          />
          <Text style={styles.overallText}>
            {stats?.vistas ?? 0} de {stats?.total ?? 0} frases vistas
          </Text>
        </View>
      </Card>

      <SectionTitle title="Últimas tres semanas" />
      <Card style={styles.chart}>
        <View style={styles.bars}>
          {days.length === 0 ? (
            <Text style={styles.noData}>Todavía no hay días registrados.</Text>
          ) : (
            ventana.map((d) => (
              <View key={d.dia} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (d.respuestas / max) * 88),
                      backgroundColor:
                        d.respuestas > 0 ? color.accent : color.surfaceHigh,
                    },
                  ]}
                />
              </View>
            ))
          )}
        </View>
      </Card>

      <SectionTitle title="Detalle" />
      <View style={styles.rows}>
        <Row
          label="Precisión general"
          value={`${Math.round((stats?.precision ?? 0) * 100)}%`}
        />
        <Row label="Racha más larga" value={conteo(stats?.rachaMax ?? 0, 'día')} />
        <Row
          label="Guardadas con estrella"
          value={String(stats?.favoritas ?? 0)}
          onPress={() => nav.navigate('Deck')}
        />
        <Row
          label="Se te atoran"
          value={String(stats?.atoradas ?? 0)}
          onPress={() => nav.navigate('Stuck')}
        />
      </View>
    </Screen>
  );
}

function Big({
  value,
  label,
  tint,
}: {
  value: number;
  label: string;
  tint: string;
}) {
  return (
    <View style={styles.big}>
      <Text style={[styles.bigValue, { color: tint }]}>{value}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
    marginBottom: space.lg,
  },
  hero: { gap: space.lg },
  heroRow: { flexDirection: 'row', justifyContent: 'space-around' },
  big: { alignItems: 'center', gap: space.xs },
  bigValue: { fontSize: 40, letterSpacing: 40 * -0.015, fontFamily: font.family.display },
  bigLabel: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted },
  overall: { gap: space.sm },
  overallText: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
  },

  chart: { paddingVertical: space.lg },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 96,
    gap: space.xs,
  },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  noData: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.sm },

  rows: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  rowLabel: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  rowValue: {
    fontSize: font.size.md,
    color: color.textMuted,
    fontFamily: font.family.bodyStrong,
  },
});
