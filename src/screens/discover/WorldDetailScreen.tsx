import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Header, ProgressBar, Screen } from '@/components/base';
import { getPackCounts } from '@/db/queries';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { color, font, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Rt = RouteProp<RootStackParams, 'WorldDetail'>;

/** P-04, los packs de un mundo. */
export function WorldDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const content = useMemo(loadContent, []);

  const [counts, setCounts] = useState<
    Record<string, { total: number; vistas: number; dominadas: number }>
  >({});

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getPackCounts(user.id, filter()).then(setCounts);
    }, [user, filter])
  );

  const mundo = content.packs.mundos.find((m) => m.id === params.worldId);
  const packs = content.packs.packs
    .filter((p) => p.mundo === params.worldId)
    .sort((a, b) => a.orden - b.orden);

  const tint =
    color.world[params.worldId as keyof typeof color.world] ?? color.accent;

  return (
    <Screen scroll>
      <Header
        onBack={() => nav.goBack()}
        title={mundo?.nombre ?? 'Mundo'}
        subtitle={mundo?.descripcion}
      />

      <View style={styles.list}>
        {packs.map((p) => {
          const c = counts[p.id] ?? { total: 0, vistas: 0, dominadas: 0 };
          return (
            <Card
              key={p.id}
              accent={tint}
              onPress={() => nav.navigate('PackDetail', { packId: p.id })}
              style={styles.pack}
            >
              <View style={styles.head}>
                <Text style={styles.name}>{p.nombre}</Text>
                {p.empaquetado ? (
                  <Text style={styles.tag}>Ya incluido</Text>
                ) : null}
              </View>
              <Text style={styles.desc} numberOfLines={2}>
                {p.descripcion}
              </Text>
              <ProgressBar
                value={c.vistas}
                total={Math.max(1, c.total || p.total_entradas)}
                tint={tint}
                height={4}
              />
              <Text style={styles.meta}>
                {c.vistas} vistas · {c.dominadas} dominadas ·{' '}
                {c.total || p.total_entradas} en total
              </Text>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  pack: { gap: space.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
    flex: 1,
  },
  tag: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.correct },
  desc: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  meta: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
});
