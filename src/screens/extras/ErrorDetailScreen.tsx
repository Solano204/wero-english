import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, Card, Header, Screen } from '@/components/base';
import { AudioButton, SceneImage } from '@/components/card';
import { loadContent } from '@/store/content';
import { color, font, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Rt = RouteProp<RootStackParams, 'ErrorDetail'>;

/** Ficha de un error. Las de pronunciación traen el par de contraste. */
export function ErrorDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const content = useMemo(loadContent, []);

  const err = content.errores.errores.find((e) => e.id === params.errorId);
  if (!err) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
      </Screen>
    );
  }

  const esPronunciacion = err.categoria === 'pronunciacion';

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} />

      <Card style={styles.bad}>
        <Text style={styles.label}>Lo que dices</Text>
        <Text style={styles.badText}>{err.lo_que_dices}</Text>
        {esPronunciacion && err.audio_contraste_archivo ? (
          <AudioButton
            path={err.audio_contraste_archivo}
            size="sm"
            label="Así suena"
          />
        ) : null}
      </Card>

      <Card style={styles.understood}>
        <Text style={styles.label}>Lo que entienden</Text>
        <Text style={styles.understoodText}>{err.lo_que_entienden}</Text>
        {err.imagen ? (
          <SceneImage
            path={err.imagen}
            size={180}
            ancha
            style={styles.errImg}
            etiqueta={err.lo_correcto}
          />
        ) : null}
      </Card>

      <Card style={styles.good}>
        <Text style={styles.label}>Lo correcto</Text>
        <Text style={styles.goodText}>{err.lo_correcto}</Text>
        <Text style={styles.ipa}>{err.ipa_correcto}</Text>
        <AudioButton path={err.audio} size="md" label="Escuchar" />
      </Card>

      <View style={styles.why}>
        <Text style={styles.whyHead}>Por qué pasa</Text>
        <Text style={styles.whyBody}>{err.por_que}</Text>
      </View>

      <View style={styles.tags}>
        {err.gravedad === 3 ? (
          <Badge label="Cambia el significado" tone="strong" small />
        ) : err.gravedad === 2 ? (
          <Badge label="Te delata" tone="warn" small />
        ) : (
          <Badge label="Suena raro" tone="neutral" small />
        )}
        {err.compartible ? <Badge label="Para contar" tone="accent" small /> : null}
      </View>

      {err.entrada_relacionada ? (
        <Button
          label="Ver la frase completa"
          variant="secondary"
          onPress={() =>
            nav.navigate('Detail', { entryId: err.entrada_relacionada! })
          }
          style={styles.link}
          full
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bad: { gap: space.sm, borderLeftWidth: 3, borderLeftColor: color.riskStrong },
  understood: {
    gap: space.xs,
    marginTop: space.sm,
    backgroundColor: color.riskWarnSoft,
  },
  good: {
    gap: space.sm,
    marginTop: space.sm,
    borderLeftWidth: 3,
    borderLeftColor: color.correct,
  },
  label: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: font.family.bodyStrong,
  },
  badText: {
    fontFamily: font.family.body,
    fontSize: font.size.xl,
    color: color.text,
    textDecorationLine: 'line-through',
    lineHeight: font.size.xl * 1.3,
  },
  understoodText: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.riskWarn,
    fontStyle: 'italic',
  },
  goodText: {
    fontSize: font.size.xl,
    color: color.text,
    fontFamily: font.family.heading,
    lineHeight: font.size.xl * 1.3,
  },
  errImg: { alignSelf: 'center', marginTop: space.sm },
  ipa: { fontFamily: font.family.ipa, fontSize: font.size.sm, color: color.textMuted },
  why: { marginTop: space.xl, gap: space.sm },
  whyHead: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: font.family.bodyStrong,
  },
  whyBody: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.6,
  },
  tags: { flexDirection: 'row', gap: space.xs, marginTop: space.lg },
  link: { marginTop: space.xl },
});
