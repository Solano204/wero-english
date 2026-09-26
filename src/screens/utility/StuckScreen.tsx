import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Carga, EmptyState, Header, Screen } from '@/components/base';
import { TarjetaAtorada } from '@/components/atoradas/TarjetaAtorada';
import { getStuckEntries } from '@/db/queries';
import { ordenarAtoradas } from '@/domain/atoradas';
import { useCarga } from '@/hooks/useCarga';
import * as audio from '@/services/audio';
import { useAuthStore } from '@/store';
import { color, font, space } from '@/theme';
import { conteo } from '@/utils/text';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Atorada = { entry: Entry; fallos: number };

/** Cuántas tarjetas entran animadas al abrir la pantalla; el resto aparece directo. */
const ANIMADAS = 8;

/**
 * P-14, las que se atoran.
 *
 * Sin cronómetro y sin calificación: aquí el usuario solo lee y escucha.
 * Convertir esto en otro examen es exactamente lo contrario de lo que
 * necesita alguien que ya falló la frase cinco veces.
 *
 * Cada frase es una sola tarjeta con su medidor de atasco; las que tienen más fallos van arriba y más grandes. No hay un
 * botón principal en el pie: «Corregir N errores» (el verbo de Hoy y de Progreso) lleva a esta misma pantalla, y no existe
 * otra sesión para corregirlas.
 */
export function StuckScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const carga = useCarga(
    async () => (user ? getStuckEntries(user.id, 3, 30) : []),
    [user],
    { alEnfocar: true, esVacio: (d) => d.length === 0 }
  );
  const items = useMemo(() => ordenarAtoradas(carga.datos ?? []), [carga.datos]);

  // Perder el foco (abrir el Detalle) corta la voz: el reproductor de frases es uno solo y compartido.
  useFocusEffect(
    useCallback(
      () => () => {
        audio.stop();
      },
      []
    )
  );

  const abrir = useCallback(
    (e: Entry) => nav.navigate('Detail', { entryId: e.id }),
    [nav]
  );
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Atorada>) => (
      <TarjetaAtorada entry={item.entry} fallos={item.fallos} indice={index} animar={index < ANIMADAS} onAbrir={abrir} />
    ),
    [abrir]
  );

  if (carga.estado !== 'listo') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Se me atoran" />
        <Carga
          carga={carga}
          vacio={
            <EmptyState
              icon="check"
              iconColor={color.correct}
              title="Ninguna por ahora"
              body="Cuando falles la misma frase tres veces, aparecerá aquí para que la repases con calma."
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
        <Header onBack={() => nav.goBack()} title="Se me atoran" subtitle={conteo(items.length, 'frase')} />
      </View>
      <FlatList
        data={items}
        keyExtractor={claveAtorada}
        renderItem={renderItem}
        ListHeaderComponent={
          <Text style={styles.intro}>Sin cronómetro ni calificación. Léelas, escúchalas y ya.</Text>
        }
        ItemSeparatorComponent={Separador}
        contentContainerStyle={styles.list}
        initialNumToRender={ANIMADAS}
        windowSize={7}
        removeClippedSubviews
      />
    </Screen>
  );
}

const claveAtorada = (a: Atorada) => String(a.entry.id);

function Separador() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.sm },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.md },
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    marginBottom: space.lg,
  },
});
