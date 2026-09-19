import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Card, EmptyState, Header, Icon, Screen } from '@/components/base';
import { loadContent } from '@/store/content';
import { color, font, radius, space } from '@/theme';
import type { ErrorCategoria } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

const CATS: { id: ErrorCategoria | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'falso_amigo', label: 'Falsos amigos' },
  { id: 'calco', label: 'Calcos' },
  { id: 'gramatica', label: 'Gramática' },
  { id: 'preposicion', label: 'Preposiciones' },
  { id: 'pronunciacion', label: 'Pronunciación' },
  { id: 'registro', label: 'Tono' },
  { id: 'escritura', label: 'Escritura' },
];

/** P-22, los errores que te delatan. */
export function ErrorsScreen() {
  const nav = useNavigation<Nav>();
  const content = useMemo(loadContent, []);
  const [cat, setCat] = useState<ErrorCategoria | 'todos'>('todos');

  const lista = content.errores.errores
    .filter((e) => (cat === 'todos' ? true : e.categoria === cat))
    // Los de gravedad 3 primero: son los que cambian el significado.
    .sort((a, b) => b.gravedad - a.gravedad || a.orden - b.orden);

  if (content.errores.errores.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Errores" />
        <EmptyState
          icon="warning"
          title="Falta el contenido"
          body="Pega errores.json en assets/data y recarga la app."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header
        onBack={() => nav.goBack()}
        title="Errores que te delatan"
        subtitle={`${lista.length} de ${content.errores.total}`}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATS.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCat(c.id)}
            style={[styles.chip, cat === c.id && styles.chipOn]}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, cat === c.id && styles.chipTextOn]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.list}>
        {lista.map((e) => (
          <Card
            key={e.id}
            style={styles.item}
            accent={gravedadTint(e.gravedad)}
            onPress={() => nav.navigate('ErrorDetail', { errorId: e.id })}
          >
            <View style={styles.row}>
              <Icon name="close" size="md" color={color.riskStrong} />
              <Text style={styles.bad} numberOfLines={2}>
                {e.lo_que_dices}
              </Text>
            </View>
            <Text style={styles.understood}>{e.lo_que_entienden}</Text>
            <View style={styles.row}>
              <Icon name="check" size="md" color={color.correct} />
              <Text style={styles.good} numberOfLines={2}>
                {e.lo_correcto}
              </Text>
            </View>
            {e.gravedad === 3 ? (
              <Badge label="Cambia el significado" tone="strong" small />
            ) : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

function gravedadTint(g: 1 | 2 | 3): string {
  if (g === 3) return color.riskStrong;
  if (g === 2) return color.riskWarn;
  return color.textFaint;
}

const styles = StyleSheet.create({
  chips: { gap: space.xs, paddingVertical: space.sm, paddingRight: space.lg },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  chipText: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  chipTextOn: { color: color.accent, fontFamily: font.family.bodyStrong },

  list: { gap: space.sm, marginTop: space.sm },
  item: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  bad: {
    flex: 1,
    fontSize: font.size.md,
    color: color.text,
    fontFamily: font.family.body,
    textDecorationLine: 'line-through',
  },
  good: {
    flex: 1,
    fontSize: font.size.md,
    color: color.text,
    fontFamily: font.family.bodyStrong,
  },
  understood: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.riskWarn,
    fontStyle: 'italic',
    marginLeft: space.lg + space.xs,
    marginBottom: space.xs,
  },
});
