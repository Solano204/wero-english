import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import { Badge, Card, Header, Icon, Screen } from '@/components/base';
import { AudioButton } from '@/components/card';
import { loadContent } from '@/store/content';
import { useSettingsStore } from '@/store';
import { color, font, space, aparecer, reacomodar } from '@/theme';
import type { PhrasalVerb } from '@/types';

/**
 * Phrasal verbs, agrupados por verbo.
 *
 * Lo que hay que aprender aquí no es una palabra sino que el mismo verbo
 * cambia de significado por completo según la partícula. `Give up` no
 * tiene nada que ver con `give in`, y estudiarlos como entradas sueltas
 * es exactamente lo que hace que nunca se peguen.
 *
 * Por eso la pantalla abre con la lista de verbos y no con la de 67
 * frases: el usuario ve las cinco caras de `take` juntas y ahí es donde
 * cae el veinte.
 */
export function PhrasalScreen() {
  const nav = useNavigation();
  const content = useMemo(loadContent, []);
  const modoLimpio = useSettingsStore((s) => s.modoLimpio);
  const [abierto, setAbierto] = useState<string | null>(null);

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

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title="Phrasal verbs" />

      <Text style={styles.intro}>
        El verbo no cambia, la partícula sí, y con ella cambia todo el
        significado. Por eso van juntos: {content.phrasal.total} frases en{' '}
        {grupos.length} verbos.
      </Text>

      <View style={styles.lista}>
        {grupos.map((g) => {
          const esta = abierto === g.verbo;
          return (
            <Animated.View key={g.verbo} layout={reacomodar()}>
              <Card
                onPress={() => setAbierto(esta ? null : g.verbo)}
                style={styles.grupo}
              >
                <View style={styles.grupoCabeza}>
                  <Text style={styles.verbo}>{g.verbo}</Text>
                  <View style={styles.cuantosFila}>
                    <Text style={styles.cuantos}>
                      {g.ids.length}{' '}
                      {g.ids.length === 1 ? 'forma' : 'formas'}
                    </Text>
                    <Icon name={esta ? 'chevron-down' : 'chevron-right'} size="sm" color={color.textFaint} />
                  </View>
                </View>

                {esta ? (
                  <Animated.View
                    entering={aparecer()}
                    style={styles.formas}
                  >
                    {g.ids.map((id) => {
                      const v = porId.get(id);
                      if (!v) return null;
                      return <Forma key={id} v={v} />;
                    })}
                  </Animated.View>
                ) : (
                  <Text style={styles.previa} numberOfLines={1}>
                    {g.ids
                      .map((id) => porId.get(id)?.particula)
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
              </Card>
            </Animated.View>
          );
        })}
      </View>
    </Screen>
  );
}

function Forma({ v }: { v: PhrasalVerb }) {
  return (
    <View style={styles.forma}>
      <View style={styles.formaCabeza}>
        <Text style={styles.frase}>{v.frase}</Text>
        {v.vulgaridad === 2 ? (
          <Badge label="Fuerte" tone="strong" small />
        ) : v.vulgaridad === 1 ? (
          <Badge label="Cuidado" tone="warn" small />
        ) : null}
      </View>
      <View style={styles.audioFila}>
        <AudioButton path={v.audio_frase} size="sm" />
        <AudioButton path={v.audio_frase_lento} size="sm" slow />
      </View>

      <View style={styles.audioFila}>
        <Text style={styles.significado}>{v.significado}</Text>
        <AudioButton path={v.audio_significado} size="sm" />
      </View>

      <View style={styles.ejemploFila}>
        <Text style={styles.ejemplo}>{v.ejemplo}</Text>
      </View>
      <View style={styles.audioFila}>
        <AudioButton path={v.audio_ejemplo} size="sm" />
        <AudioButton path={v.audio_ejemplo_lento} size="sm" slow />
      </View>

      <View style={styles.audioFila}>
        <Text style={styles.traduccion}>{v.traduccion}</Text>
        <AudioButton path={v.audio_traduccion} size="sm" />
      </View>

      <Text style={styles.nota}>{v.nota}</Text>

      {v.separable ? (
        <Text style={styles.separable}>
          Separable: el objeto puede ir en medio ({v.verbo} it {v.particula})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    marginBottom: space.lg,
  },
  lista: { gap: space.sm },
  grupo: { gap: space.xs },
  grupoCabeza: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  verbo: {
    fontSize: font.size.xl,
    fontFamily: font.family.display,
    color: color.text,
  },
  cuantosFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cuantos: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  previa: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  formas: { gap: space.md, marginTop: space.sm },
  forma: {
    gap: 3,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  formaCabeza: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  frase: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.accent,
  },
  significado: { flex: 1, fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  audioFila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  ejemploFila: { marginTop: space.xs },
  ejemplo: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    fontStyle: 'italic',
  },
  traduccion: { flex: 1, fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textFaint,
    marginTop: space.xs,
  },
  separable: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.world.tech },
});
