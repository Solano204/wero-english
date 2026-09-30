import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Carga, Header, ProgressBar, Screen } from '@/components/base';
import { Hueso, HuesoTexto, ProveedorEsqueleto } from '@/components/esqueleto';
import { getPackCounts } from '@/data/repos/estadisticas';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/data/contenido';
import { color, font, radius, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';
import { PuntoMundo } from '@/components/list';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Rt = RouteProp<RootStackParams, 'WorldDetail'>;

/** P-04, los packs de un mundo. */
export function WorldDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const content = useMemo(loadContent, []);

  const carga = useCarga(
    async (): Promise<Record<string, { total: number; vistas: number; dominadas: number }>> =>
      user ? getPackCounts(user.id, filter()) : {},
    [user, filter],
    { alEnfocar: true }
  );

  const mundo = content.packs.mundos.find((m) => m.id === params.worldId);
  const packs = content.packs.packs
    .filter((p) => p.mundo === params.worldId)
    .sort((a, b) => a.orden - b.orden);

  const tint =
    color.world[params.worldId as keyof typeof color.world] ?? color.accent;

  return (
    <Screen scroll>
      <Header
        onBack={() => nav.goBack()}
        title={mundo?.nombre ?? 'Mundo'}
        subtitle={mundo?.descripcion}
      />

      <Carga
        carga={carga}
        esqueleto={
          <ProveedorEsqueleto etiqueta="Cargando los packs" style={styles.list}>
            {Array.from({ length: 4 }, (_, i) => (
              <View key={i} style={styles.esqueletoPack}>
                <View style={styles.head}>
                  <Hueso width="55%" height={18} />
                  <Hueso width={70} height={14} />
                </View>
                <HuesoTexto lineas={1} anchos={['90%']} alto={13} />
                <Hueso width="100%" height={4} radius={2} />
              </View>
            ))}
          </ProveedorEsqueleto>
        }
      >
        {(counts) => (
          <View style={styles.list}>
            {packs.map((p) => {
              const c = counts[p.id] ?? { total: 0, vistas: 0, dominadas: 0 };
              return (
                <Card
                  key={p.id}
                  onPress={() => nav.navigate('PackDetail', { packId: p.id })}
                  style={styles.pack}
                >
                  <View style={styles.head}>
                    <View style={styles.titulo}>
                    <PuntoMundo tinte={tint} mundo={params.worldId} />
                    <Text style={styles.name}>{p.nombre}</Text>
                  </View>
                    {p.empaquetado ? (
                      <Text style={styles.tag}>Ya incluido</Text>
                    ) : null}
                  </View>
                  <Text style={styles.desc} numberOfLines={2}>
                    {p.descripcion}
                  </Text>
                  <ProgressBar
                    value={c.vistas}
                    total={Math.max(1, c.total || p.total_entradas)}
                    tint={tint}
                    height={4}
                  />
                  <Text style={styles.meta}>
                    {c.vistas} vistas · {c.dominadas} dominadas ·{' '}
                    {c.total || p.total_entradas} en total
                  </Text>
                </Card>
              );
            })}
          </View>
        )}
      </Carga>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  pack: { gap: space.sm },
  esqueletoPack: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 },
  name: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
    flex: 1,
  },
  tag: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.correct },
  desc: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  meta: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
});
