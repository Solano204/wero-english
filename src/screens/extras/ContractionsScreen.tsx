import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, EmptyState, ErrorCarga, Header, Screen, Presionable } from '@/components/base';
import { Hueso, ProveedorEsqueleto } from '@/components/esqueleto';
import { AudioButton } from '@/components/card';
import { getEntriesByIds } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import { loadContent } from '@/store/content';
import { aparecer, color, font, radius, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * P-19, "cómo suena de verdad".
 *
 * Casi todo el contenido de esta pantalla ya vivía en el catálogo: son
 * las 75 entradas del volumen 11 agrupadas en cinco categorías. Lo único
 * nuevo es el ejercicio Cázala, que está en su propia pantalla.
 */
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
  const carga = useCarga(
    async (): Promise<Entry[]> => {
      const g = grupos.find((x) => x.id === activo);
      return g ? getEntriesByIds(g.entradas) : [];
    },
    [activo, grupos]
  );
  const entries = carga.datos ?? [];
  // El giro de carga sale de inmediato, sin el retraso del esqueleto: es lo que ya se veía.
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
                <Hueso width="60%" height={16} />
                <Hueso width={40} height={12} />
                <Hueso width="50%" height={16} />
              </Card>
            ))}
          </ProveedorEsqueleto>
        ) : null
      ) : (
        <>
          <Animated.View entering={carga.huboEsqueleto ? aparecer() : undefined} style={styles.list}>
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
          </Animated.View>

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
