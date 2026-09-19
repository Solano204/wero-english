import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Badge,
  Button,
  Card,
  Header,
  LevelBadge,
  RegistroBadge,
  RiskBadge,
  Screen,
} from '@/components/base';
import { PhraseBlock, SceneImage } from '@/components/card';
import { getEntry, toggleFavorite } from '@/db/queries';
import { useAuthStore } from '@/store';
import { color, font, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Rt = RouteProp<RootStackParams, 'Detail'>;

/**
 * P-12, la ficha completa de una frase.
 *
 * Aquí vive todo lo que no cabe en la tarjeta: las variantes de
 * traducción, la versión neutra, cuándo NO usarla y por qué.
 */
export function DetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    void getEntry(params.entryId).then(setEntry);
  }, [params.entryId]);

  const alternar = useCallback(async () => {
    if (!user || !entry) return;
    setFav(await toggleFavorite(user.id, entry.id));
  }, [user, entry]);

  if (!entry) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
      </Screen>
    );
  }

  const tieneVariantes = entry.spanish !== entry.spanish_main;
  const tieneNeutro =
    entry.vulgaridad > 0 && entry.es_neutro !== entry.spanish_main;

  return (
    <Screen scroll>
      <Header
        onBack={() => nav.goBack()}
        right={
          <Button
            label={fav ? '★' : '☆'}
            variant="ghost"
            onPress={alternar}
          />
        }
      />

      <Card style={styles.hero}>
        {/* La imagen ocupa todo el ancho de la tarjeta. Cuadrada y
            centrada dejaba dos columnas de aire a los lados. */}
        <SceneImage
          path={entry.imagen}
          size={180}
          ancha
          etiqueta={entry.phrase}
          style={styles.heroImg}
        />
        <PhraseBlock entry={entry} size="lg" showSpanish />
      </Card>

      <View style={styles.tags}>
        <RiskBadge vulgaridad={entry.vulgaridad} />
        <RegistroBadge registro={entry.registro} />
        <LevelBadge nivel={entry.nivel} />
        {entry.vigencia === 'efimera' ? (
          <Badge label="Puede pasar de moda" tone="warn" small />
        ) : null}
      </View>

      {entry.no_usar_cuando ? (
        <Card style={styles.warn} accent={color.riskWarn}>
          <Text style={styles.warnHead}>Cuándo NO decirla</Text>
          <Text style={styles.warnBody}>{entry.no_usar_cuando}</Text>
        </Card>
      ) : null}

      {tieneVariantes ? (
        <Block title="Otras formas de traducirla" body={entry.spanish} />
      ) : null}

      {tieneNeutro ? (
        <Block title="Versión sin groserías" body={entry.es_neutro} />
      ) : null}

      {entry.note ? <Block title="Nota" body={entry.note} /> : null}

      {entry.vulgar_marks.length > 0 ? (
        <Block
          title="Palabras fuertes"
          body={entry.vulgar_marks.join(' · ')}
        />
      ) : null}

      {entry.ipa_note ? <Block title="Pronunciación" body={entry.ipa_note} /> : null}

      <Block
        title="Dónde vive"
        body={`${entry.block} · ${entry.mundo}`}
      />
    </Screen>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.blockBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    // Mas aire entre bloques: frase, IPA, audio y traduccion son cuatro
    // cosas distintas y con gap md se leian como un parrafo.
    gap: space.xl,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  heroImg: { marginBottom: space.xs },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.md,
  },
  warn: { marginTop: space.lg, gap: space.xs },
  warnHead: {
    fontSize: font.size.xs,
    color: color.riskWarn,
    fontWeight: font.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  warnBody: {
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.5,
  },
  block: { marginTop: space.lg, gap: space.xs },
  blockTitle: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: font.weight.semibold,
  },
  blockBody: {
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.5,
  },
});
