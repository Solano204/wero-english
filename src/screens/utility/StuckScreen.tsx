import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Carga, EmptyState, Header, Screen } from '@/components/base';
import { HuesoTarjeta, ProveedorEsqueleto } from '@/components/esqueleto';
import { Desatorar } from '@/components/atoradas/Desatorar';
import { TarjetaAtorada } from '@/components/atoradas/TarjetaAtorada';
import { getCardStates } from '@/data/repos/tarjetas';
import { getEntriesByIds, getStuckEntries } from '@/data/repos/frases';
import {
  candidatasDestrabadas,
  destrabadas,
  mismasVistas,
  normalizarVistas,
  ordenarAtoradas,
  vistasDe,
  type AtoradaVista,
} from '@/domain/atoradas';
import { useCarga } from '@/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import { useAuthStore, useSettingsStore } from '@/store';
import { color, font, motionDesatorar, space } from '@/theme';
import { conteo } from '@/domain/texto';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Atorada = { entry: Entry; fallos: number };
/** Una frase que se desatoró desde la última visita, con lo que tardará en arrancar su animación. */
type Desatorada = Atorada & { retraso: number };

interface Datos {
  atoradas: Atorada[];
  desatoradas: Atorada[];
  /** Lo que había guardado de la última visita: para saber si hay algo que volver a guardar. */
  previas: AtoradaVista[];
}

/** Cuántas tarjetas entran animadas al abrir la pantalla; el resto aparece directo. */
const ANIMADAS = 8;

/**
 * P-14, las que se atoran.
 *
 * Sin cronómetro y sin calificación: aquí el usuario solo lee y escucha.
 * Convertir esto en otro examen es exactamente lo contrario de lo que
 * necesita alguien que ya falló la frase cinco veces.
 *
 * Cada frase es una sola tarjeta con su medidor de atasco; las que tienen más fallos van arriba y más grandes. Al abrir se
 * compara con la última visita (`atoradasVistas` en ajustes): las frases que ya no están atoradas aparecen arriba un
 * momento («Ya no se te atora») y luego queda la lista de ahora, que es lo que se guarda para la próxima. No hay un botón
 * principal en el pie: «Corregir N errores» (el verbo de Hoy y de Progreso) lleva a esta misma pantalla, y no existe otra
 * sesión para corregirlas.
 */
export function StuckScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const guardarAjuste = useSettingsStore((s) => s.set);
  const carga = useCarga<Datos>(
    async () => {
      if (!user) return { atoradas: [], desatoradas: [], previas: [] };
      const atoradas = await getStuckEntries(user.id, 3, 30);
      const previas = normalizarVistas(useSettingsStore.getState().atoradasVistas);
      // Una que solo salió de la lista por el tope de 30 sigue atorada: se le pregunta a la base si de verdad se destrabó.
      const candidatas = candidatasDestrabadas(previas, atoradas.map((a) => a.entry.id));
      if (candidatas.length === 0) return { atoradas, desatoradas: [], previas };
      const estados = await getCardStates(user.id, candidatas.map((c) => c.id));
      const ganadas = destrabadas(candidatas, estados);
      const entradas = await getEntriesByIds(ganadas.map((g) => g.id));
      const porId = new Map(entradas.map((e) => [e.id, e]));
      const desatoradas = ganadas.flatMap((g) => {
        const entry = porId.get(g.id);
        return entry ? [{ entry, fallos: g.fallos }] : [];
      });
      return { atoradas, desatoradas, previas };
    },
    [user],
    { alEnfocar: true, esVacio: (d) => d.atoradas.length === 0 && d.desatoradas.length === 0 }
  );
  const items = useMemo(() => ordenarAtoradas(carga.datos?.atoradas ?? []), [carga.datos]);

  // Lo que se guarda al terminar de cargar es la lista de ahora: la próxima visita compara contra ella.
  useEffect(() => {
    const d = carga.datos;
    if (!d || !user) return;
    const actuales = vistasDe(d.atoradas);
    if (!mismasVistas(d.previas, actuales)) void guardarAjuste(user.id, 'atoradasVistas', actuales);
  }, [carga.datos, user, guardarAjuste]);

  // Las desatoradas se muestran una sola vez, aunque la pantalla vuelva a cargar al recuperar el foco.
  const [mostrando, setMostrando] = useState<Desatorada[]>([]);
  const yaMostradas = useRef(new Set<number>());
  useEffect(() => {
    const nuevas = (carga.datos?.desatoradas ?? []).filter((d) => !yaMostradas.current.has(d.entry.id));
    if (nuevas.length === 0) return;
    nuevas.forEach((d) => yaMostradas.current.add(d.entry.id));
    setMostrando((m) => [...m, ...nuevas.map((d, i) => ({ ...d, retraso: i * motionDesatorar.escalon }))]);
  }, [carga.datos]);
  const retirar = useCallback((id: number) => setMostrando((m) => m.filter((d) => d.entry.id !== id)), []);

  // Perder el foco (abrir el Detalle) corta todo el audio: el reproductor de frases es uno solo y compartido.
  useCortarAudioAlSalir();

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

  const vacio = (
    <EmptyState
      icon="check"
      iconColor={color.correct}
      title="Ninguna por ahora"
      body="Cuando falles la misma frase tres veces, aparecerá aquí para que la repases con calma."
    />
  );

  if (carga.estado !== 'listo') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Se me atoran" />
        <Carga
          carga={carga}
          vacio={vacio}
          esqueleto={
            <ProveedorEsqueleto etiqueta="Cargando las atoradas" style={styles.list}>
              {Array.from({ length: 6 }, (_, i) => (
                <HuesoTarjeta key={i} lineas={1} />
              ))}
            </ProveedorEsqueleto>
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
          title="Se me atoran"
          subtitle={items.length > 0 ? conteo(items.length, 'frase') : undefined}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={claveAtorada}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <Text style={styles.intro}>Sin cronómetro ni calificación. Léelas, escúchalas y ya.</Text>
            {mostrando.map((d) => (
              <Desatorar key={d.entry.id} entry={d.entry} fallos={d.fallos} retraso={d.retraso} onTerminar={() => retirar(d.entry.id)} />
            ))}
          </View>
        }
        ListEmptyComponent={<View style={styles.vacio}>{vacio}</View>}
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
  vacio: { paddingVertical: space.xxl },
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    marginBottom: space.lg,
  },
});
