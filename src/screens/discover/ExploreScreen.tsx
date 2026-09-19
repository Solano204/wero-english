import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Input, ProgressBar, Screen } from '@/components/base';
import { EntryRow, SectionTitle } from '@/components/list';
import { getWorldCounts, searchEntries } from '@/db/queries';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { PORTADA_MUNDO, color, font, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** P-03, los ocho mundos, con buscador encima. */
export function ExploreScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const content = useMemo(loadContent, []);

  const [counts, setCounts] = useState<
    Record<string, { total: number; vistas: number }>
  >({});
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Entry[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getWorldCounts(user.id, filter()).then(setCounts);
    }, [user, filter])
  );

  const buscar = useCallback(
    async (t: string) => {
      setTerm(t);
      if (t.trim().length < 2) {
        setResults([]);
        return;
      }
      setResults(await searchEntries(t, filter(), 30));
    },
    [filter]
  );

  const mundos = [...content.packs.mundos].sort((a, b) => a.orden - b.orden);
  const buscando = term.trim().length >= 2;

  return (
    <Screen scroll>
      <Text style={styles.title}>Vocabulario</Text>

      <Input
        value={term}
        onChangeText={buscar}
        placeholder="Busca una frase o su traducción"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {buscando ? (
        <View style={styles.results}>
          <SectionTitle title="Resultados" count={results.length} />
          {results.length === 0 ? (
            <Text style={styles.none}>Nada con esas palabras.</Text>
          ) : (
            results.map((e, i) => (
              <EntryRow
                key={e.id}
                entry={e}
                index={i}
                onPress={() => nav.navigate('Detail', { entryId: e.id })}
              />
            ))
          )}
        </View>
      ) : (
        <View style={styles.worlds}>
          {mundos.map((m) => {
            const c = counts[m.id] ?? { total: 0, vistas: 0 };
            const tint =
              color.world[m.id as keyof typeof color.world] ?? color.accent;
            return (
              <Card
                key={m.id}
                accent={tint}
                onPress={() => nav.navigate('WorldDetail', { worldId: m.id })}
                style={styles.world}
                // Portada: la imagen si existe, y si no el degradado del
                // mundo. Las dos se ven bien; una se ve mejor.
                portada={m.id}
                imagen={PORTADA_MUNDO[m.id]}
                altoPortada={96}
              >
                <View style={styles.worldHead}>
                  <Text style={styles.worldName}>{m.nombre}</Text>
                  <Text style={styles.worldCount}>
                    {c.vistas}/{c.total}
                  </Text>
                </View>
                <Text style={styles.worldDesc} numberOfLines={2}>
                  {m.descripcion}
                </Text>
                <ProgressBar
                  value={c.vistas}
                  total={Math.max(1, c.total)}
                  tint={tint}
                  height={4}
                />
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
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
  worlds: { gap: space.sm, marginTop: space.lg },
  world: { gap: space.sm },
  worldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  worldName: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
  },
  worldCount: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  worldDesc: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  results: { gap: space.sm },
  none: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md, marginTop: space.md },
});
