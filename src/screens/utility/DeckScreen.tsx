import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Carga, EmptyState, Header, Screen } from '@/components/base';
import { Marcador } from '@/components/fx';
import { TarjetaGuardada } from '@/components/mazo/TarjetaGuardada';
import { getFavorites } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { color, font, space } from '@/theme';
import { conteo, plural } from '@/utils/text';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Cuántas tarjetas entran animadas al abrir la pantalla; el resto aparece directo. */
const ANIMADAS = 8;

/**
 * P-17, mi mazo: las guardadas con estrella, cada una como una tarjeta con su karaoke y su grupo Inglés · Español. Arriba,
 * cuántas hay con el `Marcador`. El orden es el de siempre (lo último que repasaste primero): no se guarda la fecha en
 * que se guardó una frase. Aquí no hay «Repasar»: la sesión de estudio no recibe listas sin tocar SM-2 ni la cola del día.
 */
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
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Entry>) => (
      <TarjetaGuardada entry={item} indice={index} animar={index < ANIMADAS} onAbrir={abrir} />
    ),
    [abrir]
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
              actionLabel="Ir a Frases sueltas"
              onAction={() => nav.navigate('Azar')}
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
        <Header onBack={() => nav.goBack()} title="Mi mazo" />
        <View style={styles.conteo} accessible accessibilityRole="header" accessibilityLabel={conteo(items.length, 'guardada')}>
          <View style={styles.conteoVista} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Marcador valor={items.length} tamano={font.size.xxl} color={color.text} />
            <Text style={styles.conteoResto}>{plural(items.length, 'guardada')}</Text>
          </View>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={claveEntrada}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separador}
        initialNumToRender={ANIMADAS}
        windowSize={7}
        removeClippedSubviews
      />
    </Screen>
  );
}

const claveEntrada = (e: Entry) => String(e.id);

function Separador() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.sm },
  conteo: { marginBottom: space.sm },
  conteoVista: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  conteoResto: { fontFamily: font.family.display, fontSize: font.size.xl, color: color.textMuted },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.md },
});
