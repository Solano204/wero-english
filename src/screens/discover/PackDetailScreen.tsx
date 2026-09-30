import React, { useCallback, useMemo } from 'react';
import { conteo } from '@/utils/text';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Carga, Header, Screen } from '@/components/base';
import { ProveedorEsqueleto } from '@/components/esqueleto';
import { EntryRow, EntryRowHueso } from '@/components/list';
import { getPackEntries } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
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

  const carga = useCarga(() => getPackEntries(params.packId, filter()), [params.packId, filter], {
    alEnfocar: true,
  });

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
          subtitle={carga.datos ? conteo(carga.datos.length, 'frase') : undefined}
        />
        <Button
          label="Estudiar este pack"
          onPress={() => nav.navigate('Study', { packId: params.packId })}
          full
        />
      </View>

      <Carga
        carga={carga}
        esqueleto={
          <ProveedorEsqueleto etiqueta="Cargando las frases" style={[styles.list, styles.esqueleto]}>
            {Array.from({ length: 6 }, (_, i) => (
              <EntryRowHueso key={i} />
            ))}
          </ProveedorEsqueleto>
        }
      >
        {(entries) => (
          <FlatList
            data={entries}
            keyExtractor={(e) => String(e.id)}
            renderItem={({ item, index }) => (
              <EntryRow entry={item} index={index} onPress={abrir} />
            )}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={Separador}
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
        )}
      </Carga>
    </Screen>
  );
}

function Separador() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.sm },
  // El mismo separador que la lista real.
  esqueleto: { gap: space.sm },
  empty: {
    color: color.textMuted,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    textAlign: 'center',
    marginTop: space.xxl,
  },
});
