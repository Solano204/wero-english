import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Carga, Input, ProgressBar, Screen } from '@/components/base';
import { Hueso, HuesoCirculo, HuesoImagen, HuesoTexto, ProveedorEsqueleto } from '@/components/esqueleto';
import { EntryRow, SectionTitle, PuntoMundo } from '@/components/list';
import { getWorldCounts, searchEntries } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { PORTADA_MUNDO, color, font, radius, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Cuánto se espera sin teclear antes de buscar. */
const ESPERA_BUSQUEDA_MS = 150;

/** P-03, los ocho mundos, con buscador encima. */
export function ExploreScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const content = useMemo(loadContent, []);

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Entry[]>([]);

  const cargaMundos = useCarga(
    async (): Promise<Record<string, { total: number; vistas: number }>> =>
      user ? getWorldCounts(user.id, filter()) : {},
    [user, filter],
    { alEnfocar: true }
  );

  // Se busca cuando se deja de teclear (no en cada tecla), y una respuesta vieja nunca pisa a
  // la de lo último que se escribió.
  const pedida = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
    },
    []
  );
  const buscar = useCallback(
    (t: string) => {
      setTerm(t);
      const id = ++pedida.current;
      if (espera.current) clearTimeout(espera.current);
      if (t.trim().length < 2) {
        setResults([]);
        return;
      }
      espera.current = setTimeout(() => {
        searchEntries(t, filter(), 30)
          .then((r) => {
            if (id === pedida.current) setResults(r);
          })
          .catch(() => undefined);
      }, ESPERA_BUSQUEDA_MS);
    },
    [filter]
  );
  const abrir = useCallback((e: Entry) => nav.navigate('Detail', { entryId: e.id }), [nav]);

  const mundos = useMemo(() => [...content.packs.mundos].sort((a, b) => a.orden - b.orden), [content]);
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
                onPress={abrir}
              />
            ))
          )}
        </View>
      ) : (
        <Carga
          carga={cargaMundos}
          esqueleto={
            <ProveedorEsqueleto etiqueta="Cargando los mundos" style={styles.worlds}>
              {Array.from({ length: mundos.length || 4 }, (_, i) => (
                <View key={i} style={styles.esqueletoMundo}>
                  <HuesoImagen />
                  <View style={styles.esqueletoMundoTexto}>
                    <View style={styles.esqueletoMundoTitulo}>
                      <HuesoCirculo diametro={10} />
                      <Hueso width="45%" height={18} />
                    </View>
                    <HuesoTexto lineas={1} anchos={['80%']} alto={13} />
                    <Hueso width="100%" height={4} radius={2} />
                  </View>
                </View>
              ))}
            </ProveedorEsqueleto>
          }
        >
          {(counts) => (
            <View style={styles.worlds}>
              {mundos.map((m) => {
                const c = counts[m.id] ?? { total: 0, vistas: 0 };
                const tint =
                  color.world[m.id as keyof typeof color.world] ?? color.accent;
                return (
                  <Card
                    key={m.id}
                    onPress={() => nav.navigate('WorldDetail', { worldId: m.id })}
                    style={styles.world}
                    // Portada: la imagen si existe, y si no el degradado del
                    // mundo. Las dos se ven bien; una se ve mejor.
                    portada={m.id}
                    imagen={PORTADA_MUNDO[m.id]}
                    altoPortada={96}
                  >
                    <View style={styles.worldHead}>
                      <View style={styles.worldTitulo}>
                        <PuntoMundo tinte={tint} mundo={m.id} />
                        <Text style={styles.worldName}>{m.nombre}</Text>
                      </View>
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
        </Carga>
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
  esqueletoMundo: { backgroundColor: color.surface, borderRadius: radius.lg, overflow: 'hidden', gap: space.sm, paddingBottom: space.md },
  esqueletoMundoTexto: { paddingHorizontal: space.lg, gap: space.sm },
  esqueletoMundoTitulo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  worldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  worldTitulo: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
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
