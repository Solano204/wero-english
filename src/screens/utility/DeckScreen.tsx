import React, { useCallback } from 'react';
import { conteo } from '@/utils/text';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Carga, EmptyState, Header, Screen } from '@/components/base';
import { EntryRow } from '@/components/list';
import { getFavorites } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
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
  const carga = useCarga(
    async () => (user ? getFavorites(user.id, filter()) : []),
    [user, filter],
    { alEnfocar: true, esVacio: (d) => d.length === 0 }
  );

  const abrir = useCallback(
    (e: Entry) => nav.navigate('Detail', { entryId: e.id }),
    [nav]
  );

  const items = carga.datos ?? [];

  if (carga.estado !== 'listo') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Mi mazo" />
        <Carga
          carga={carga}
          vacio={
            <EmptyState
              icon="star"
              title="Tu mazo está vacío"
              body="Toca la estrella en cualquier frase para guardarla aquí."
            />
          }
        >
          {() => null}
        </Carga>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.head}>
        <Header
          onBack={() => nav.goBack()}
          title="Mi mazo"
          subtitle={conteo(items.length, 'guardada')}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item, index }) => (
          <EntryRow entry={item} index={index} variant="mazo" onPress={abrir} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separador}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
      />
    </Screen>
  );
}

function Separador() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.sm },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.md },
});
