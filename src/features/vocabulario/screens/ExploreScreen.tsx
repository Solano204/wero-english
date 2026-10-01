import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Carga, Input, ProgressBar, Screen } from '@/shared/ui';
import { Hueso, HuesoCirculo, HuesoImagen, HuesoTexto, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { EntryRow } from '@/features/vocabulario/components/EntryRow';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { PuntoMundo } from '@/shared/ui/PuntoMundo';
import { PORTADA_MUNDO, color, font, radius, space } from '@/theme';
import { useExplorar } from '@/features/vocabulario/hooks/useExplorar';

/** P-03, los ocho mundos, con buscador encima. */
export function ExploreScreen() {
  const { nav, term, results, cargaMundos, buscar, abrir, mundos, buscando } = useExplorar();

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
