import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState, Header, Screen } from '@/components/base';
import { EntryRow } from '@/components/list';
import { getFavorites } from '@/db/queries';
import { useAuthStore, useSettingsStore } from '@/store';
import { space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** P-17, mi mazo: las guardadas con estrella. */
export function DeckScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const [items, setItems] = useState<Entry[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getFavorites(user.id, filter()).then(setItems);
    }, [user, filter])
  );

  const abrir = useCallback(
    (e: Entry) => nav.navigate('Detail', { entryId: e.id }),
    [nav]
  );

  if (items.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Mi mazo" />
        <EmptyState
          emoji="☆"
          title="Tu mazo está vacío"
          body="Toca la estrella en cualquier frase para guardarla aquí."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.head}>
        <Header
          onBack={() => nav.goBack()}
          title="Mi mazo"
          subtitle={`${items.length} guardadas`}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item, index }) => (
          <EntryRow entry={item} index={index} variant="mazo" onPress={abrir} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.sm },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.md },
});
