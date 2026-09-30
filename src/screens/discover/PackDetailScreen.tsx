import React, { useCallback, useMemo } from 'react';
import { conteo } from '@/domain/texto';
import { FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Carga, Header, Screen } from '@/shared/ui';
import { ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { EntryRow } from '@/components/list/EntryRow';
import { EntryRowHueso } from '@/components/list/EntryRowHueso';
import { getPackEntries } from '@/data/repos/frases';
import { useCarga } from '@/shared/hooks/useCarga';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import { color, font, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

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
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Entry>) => <EntryRow entry={item} index={index} onPress={abrir} />,
    [abrir]
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
            keyExtractor={claveEntrada}
            renderItem={renderItem}
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

const claveEntrada = (e: Entry) => String(e.id);

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
