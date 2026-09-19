import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Header, Screen } from '@/components/base';
import { EntryRow } from '@/components/list';
import { getPackEntries } from '@/db/queries';
import { useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { color, font, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Rt = RouteProp<RootStackParams, 'PackDetail'>;

/**
 * Las frases de un pack.
 *
 * Con FlatList y no con map dentro de un ScrollView: un pack llega a 120
 * renglones y renderizarlos todos de golpe se siente al abrir.
 */
export function PackDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const filter = useSettingsStore((s) => s.filter);
  const content = useMemo(loadContent, []);

  const [entries, setEntries] = useState<Entry[]>([]);

  useFocusEffect(
    useCallback(() => {
      void getPackEntries(params.packId, filter()).then(setEntries);
    }, [params.packId, filter])
  );

  const pack = content.packs.packs.find((p) => p.id === params.packId);

  const abrir = useCallback(
    (e: Entry) => nav.navigate('Detail', { entryId: e.id }),
    [nav]
  );

  return (
    <Screen padded={false}>
      <View style={styles.head}>
        <Header
          onBack={() => nav.goBack()}
          title={pack?.nombre ?? 'Pack'}
          subtitle={`${entries.length} frases`}
        />
        <Button
          label="Estudiar este pack"
          onPress={() => nav.navigate('Study', { packId: params.packId })}
          full
        />
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item, index }) => (
          <EntryRow entry={item} index={index} onPress={abrir} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No hay frases con los filtros actuales.
          </Text>
        }
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.sm },
  empty: {
    color: color.textMuted,
    fontSize: font.size.md,
    textAlign: 'center',
    marginTop: space.xxl,
  },
});
