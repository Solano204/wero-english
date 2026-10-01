import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, EmptyState, ErrorCarga, Header, Screen, Presionable } from '@/components/base';
import { Hueso, ProveedorEsqueleto } from '@/components/esqueleto';
import { AudioButton } from '@/components/card';
import { getEntriesByIds } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import { loadContent } from '@/store/content';
import { color, font, radius, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Las entradas de todos los grupos, de una sola consulta y guardadas para toda la sesión: son 75 frases fijas del
 * catálogo. Cambiar de pestaña o volver a la pantalla ya no consulta la base ni espera nada.
 */
let porGrupoCache: Map<string, Entry[]> | null = null;

async function entradasPorGrupo(grupos: readonly { id: string; entradas: number[] }[]): Promise<Map<string, Entry[]>> {
  if (porGrupoCache) return porGrupoCache;
  const todas = await getEntriesByIds([...new Set(grupos.flatMap((g) => g.entradas))]);
  const porId = new Map(todas.map((e) => [e.id, e]));
  const mapa = new Map(
    grupos.map((g) => [g.id, g.entradas.map((id) => porId.get(id)).filter((e): e is Entry => Boolean(e))])
  );
  porGrupoCache = mapa;
  return mapa;
}

/**
 * P-19, "cómo suena de verdad".
 *
 * Casi todo el contenido de esta pantalla ya vivía en el catálogo: son
 * las 75 entradas del volumen 11 agrupadas en cinco categorías. Lo único
 * nuevo es el ejercicio Cázala, que está en su propia pantalla.
 */
const SIN_ENTRADAS: Entry[] = [];

export function ContractionsScreen() {
  const nav = useNavigation<Nav>();
  const content = useMemo(loadContent, []);
  useCortarAudioAlSalir();
  // Memoizado: con un array nuevo en cada render, el efecto de carga se
  // volvía a disparar en cada render y no paraba nunca.
  const grupos = useMemo(
    () => [...content.contracciones.grupos].sort((a, b) => a.orden - b.orden),
    [content]
  );

  const [activo, setActivo] = useState<string>(grupos[0]?.id ?? '');
  // Una sola carga para todos los grupos: la pestaña solo elige cuál se muestra.
  const carga = useCarga(() => entradasPorGrupo(grupos), [grupos]);
  const entries = carga.datos?.get(activo) ?? SIN_ENTRADAS;
  const cargando = carga.estado === 'cargando';

  if (grupos.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Cómo suena de verdad" />
        <EmptyState
          icon="warning"
          title="Falta el contenido"
          body="Pega contracciones.json en assets/data y recarga la app."
        />
      </Screen>
    );
  }

  const grupo = grupos.find((g) => g.id === activo);

  return (
    <Screen scroll>
      <Header
        onBack={() => nav.goBack()}
        title="Cómo suena de verdad"
        subtitle={`${content.contracciones.total_reducciones} reducciones`}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {grupos.map((g) => (
          <Presionable
            key={g.id}
            onPress={() => setActivo(g.id)}
            style={[styles.tab, activo === g.id && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo === g.id }}
          >
            <Text
              style={[styles.tabText, activo === g.id && styles.tabTextOn]}
            >
              {g.nombre}
            </Text>
          </Presionable>
        ))}
      </ScrollView>

      {grupo ? <Text style={styles.desc}>{grupo.descripcion}</Text> : null}

      {carga.estado === 'error' ? (
        <ErrorCarga onReintentar={carga.reintentar} />
      ) : cargando ? (
        carga.demora ? (
          <ProveedorEsqueleto etiqueta="Cargando las reducciones" style={styles.list}>
            {Array.from({ length: 5 }, (_, i) => (
              <Card key={i} style={styles.item}>
                <View style={styles.itemHead}>
                  <View style={styles.itemText}>
                    <Hueso width="60%" height={20} />
                    <Hueso width={40} height={12} />
                    <Hueso width="50%" height={16} />
                  </View>
                  <Hueso width={36} height={36} radius={radius.pill} />
                </View>
                <View style={styles.practice}>
                  <Hueso width={88} height={36} radius={radius.pill} />
                  <Hueso width={72} height={36} radius={radius.pill} />
                </View>
              </Card>
            ))}
          </ProveedorEsqueleto>
        ) : null
      ) : (
        <>
          {/* Sin fundido de entrada: arrancaba en opacidad 0 y, si no corría, la lista cargada no se veía. */}
          <View style={styles.list}>
            {entries.map((e) => (
              <Card key={e.id} style={styles.item}>
                <View style={styles.itemHead}>
                  <View style={styles.itemText}>
                    <Text style={styles.written}>{e.phrase_tts}</Text>
                    <Text style={styles.arrow}>suena</Text>
                    <Text style={styles.spoken}>{e.phrase_alt ?? e.phrase}</Text>
                  </View>
                  <AudioButton path={e.audio_en} size="sm" />
                </View>

                {e.ipa ? <Text style={styles.ipa}>{e.ipa}</Text> : null}
                {e.note ? <Text style={styles.note}>{e.note}</Text> : null}

                {e.palabras_practica.length > 0 ? (
                  <View style={styles.practice}>
                    {e.palabras_practica.map((p) => (
                      <View key={p.palabra} style={styles.pill}>
                        <AudioButton path={p.audio} size="sm" />
                        <Text style={styles.pillText}>{p.palabra}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))}
          </View>

          <Button
            label="Probar con Cázala"
            onPress={() => nav.navigate('Cazala')}
            style={styles.cta}
            full
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: space.xs, paddingVertical: space.sm, paddingRight: space.lg },
  tab: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  tabOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  tabText: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  tabTextOn: { color: color.accent, fontFamily: font.family.bodyStrong },

  desc: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted, marginTop: space.xs },
  list: { gap: space.sm, marginTop: space.md },
  item: { gap: space.sm },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  itemText: { flex: 1, gap: space.xs },
  written: {
    fontSize: font.size.lg,
    color: color.text,
    fontFamily: font.family.heading,
  },
  arrow: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  spoken: { fontFamily: font.family.body, fontSize: font.size.md, color: color.accent },
  ipa: { fontFamily: font.family.ipa, fontSize: font.size.sm, color: color.textMuted },
  note: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.textMuted,
    lineHeight: font.size.sm * 1.5,
  },
  practice: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.pill,
    paddingRight: space.md,
  },
  pillText: { flexShrink: 1, fontFamily: font.family.body, fontSize: font.size.sm, color: color.text },
  cta: { marginTop: space.xl },
});
