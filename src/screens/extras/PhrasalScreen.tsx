import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState, Header, Input, Screen } from '@/components/base';
import type { Rect } from '@/components/fx';
import { RenglonVerbo, type FormaRenglon } from '@/components/phrasal/RenglonVerbo';
import { buscarGrupos, etiquetasParticulas } from '@/domain/phrasal';
import { loadContent } from '@/data/contenido';
import { useSettingsStore } from '@/store';
import { color, font, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';
import type { PhrasalVerb } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParams>;

interface ItemVerbo {
  verbo: string;
  formas: FormaRenglon[];
  coinciden: number[];
}

const keyDe = (item: ItemVerbo) => item.verbo;
const Separador = () => <View style={styles.separador} />;

/**
 * Phrasal verbs, agrupados por verbo.
 *
 * Lo que hay que aprender aquí no es una palabra sino que el mismo verbo
 * cambia de significado por completo según la partícula. `Give up` no
 * tiene nada que ver con `give in`, y estudiarlos como entradas sueltas
 * es exactamente lo que hace que nunca se peguen.
 *
 * Por eso la pantalla abre con la lista de verbos y no con la de 207
 * frases: el usuario ve las cinco caras de `take` juntas y ahí es donde
 * cae el veinte. Tocar un verbo abre su propia página: ahí las formas
 * se eligen girando la ruleta de partículas.
 *
 * La lista está virtualizada y sus renglones no se reacomodan entre sí:
 * abrir un verbo ya no crece una tarjeta dentro de la lista, que era lo
 * que dejaba a las de abajo encimadas.
 */
export function PhrasalScreen() {
  const nav = useNavigation<Nav>();
  const content = useMemo(loadContent, []);
  const modoLimpio = useSettingsStore((s) => s.modoLimpio);
  const [consulta, setConsulta] = useState('');

  const { grupos, porId } = useMemo(() => {
    const mapa = new Map<number, PhrasalVerb>(
      content.phrasal.verbos.map((v) => [v.id, v])
    );
    // El modo limpio esconde los fuertes aquí igual que en el catálogo.
    // Si un verbo se queda sin ninguno, el grupo desaparece entero en
    // vez de mostrarse vacío.
    const gs = content.phrasal.grupos
      .map((g) => ({
        ...g,
        ids: g.ids.filter((id) => {
          const v = mapa.get(id);
          return v ? !(modoLimpio && v.vulgaridad === 2) : false;
        }),
      }))
      .filter((g) => g.ids.length > 0);
    return { grupos: gs, porId: mapa };
  }, [content, modoLimpio]);

  const items = useMemo<ItemVerbo[]>(
    () =>
      buscarGrupos(grupos, porId, consulta).map((g) => {
        const etiquetas = etiquetasParticulas(g.ids.map((id) => porId.get(id)?.particula ?? ''));
        return {
          verbo: g.verbo,
          coinciden: g.coinciden,
          formas: g.ids.map((id, i) => ({ id, etiqueta: etiquetas[i] ?? '' })),
        };
      }),
    [grupos, porId, consulta]
  );

  const abrir = useCallback(
    (verbo: string, origen: Rect | null) => nav.navigate('PhrasalVerbo', { verbo, origen }),
    [nav]
  );
  const renderItem = useCallback(
    ({ item }: { item: ItemVerbo }) => (
      <RenglonVerbo verbo={item.verbo} formas={item.formas} coinciden={item.coinciden} onAbrir={abrir} />
    ),
    [abrir]
  );

  const intro = (
    <Text style={styles.intro}>
      El verbo no cambia, la partícula sí, y con ella cambia todo el
      significado. Por eso van juntos: {content.phrasal.total} frases en{' '}
      {grupos.length} verbos.
    </Text>
  );
  const vacio = consulta.trim() ? (
    <EmptyState
      title={`Ningún verbo coincide con «${consulta.trim()}»`}
      body="Prueba con el verbo, la partícula o una palabra del significado."
      actionLabel="Borrar búsqueda"
      onAction={() => setConsulta('')}
    />
  ) : (
    <EmptyState title="Todavía no hay phrasal verbs cargados" />
  );

  return (
    <Screen style={styles.pantalla}>
      <Header onBack={() => nav.goBack()} title="Phrasal verbs" />
      <Input
        value={consulta}
        onChangeText={setConsulta}
        placeholder="Busca un verbo o una partícula"
        accessibilityLabel="Buscar un verbo o una partícula"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        style={styles.lista}
        contentContainerStyle={styles.contenido}
        data={items}
        keyExtractor={keyDe}
        renderItem={renderItem}
        ItemSeparatorComponent={Separador}
        ListHeaderComponent={intro}
        ListEmptyComponent={vacio}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        windowSize={7}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // La lista llega hasta el borde de abajo: su propio relleno reserva el hueco.
  pantalla: { paddingBottom: 0 },
  lista: { flex: 1 },
  contenido: { paddingTop: space.md, paddingBottom: space.xxxl },
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    marginBottom: space.lg,
  },
  separador: { height: space.sm },
});
