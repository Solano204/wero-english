import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, Header, Screen } from '@/components/base';
import { MedidorGravedad } from '@/components/errores/MedidorGravedad';
import { SecuenciaMalentendido } from '@/components/errores/SecuenciaMalentendido';
import * as audio from '@/services/audio';
import { loadContent } from '@/store/content';
import { color, font, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Rt = RouteProp<RootStackParams, 'ErrorDetail'>;

/**
 * Ficha de un error. Arriba, la señal que se rompe: lo que dices, lo que entienden y lo correcto en tres pasos. Las de
 * pronunciación traen el par de contraste.
 */
export function ErrorDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const content = useMemo(loadContent, []);

  // Perder el foco (salir, abrir la frase completa) corta la voz: el reproductor de frases es uno solo y compartido.
  useFocusEffect(
    useCallback(
      () => () => {
        audio.stop();
      },
      []
    )
  );

  const err = content.errores.errores.find((e) => e.id === params.errorId);
  if (!err) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} />

      <SecuenciaMalentendido key={err.id} error={err} />

      <View style={styles.why}>
        <Text style={styles.whyHead}>Por qué pasa</Text>
        <Text style={styles.whyBody}>{err.por_que}</Text>
      </View>

      <View style={styles.tags}>
        <MedidorGravedad gravedad={err.gravedad} disposicion="fila" />
        {err.compartible ? <Badge label="Para contar" tone="accent" small /> : null}
      </View>

      {err.entrada_relacionada ? (
        <Button
          label="Ver la frase completa"
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
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md, marginTop: space.lg },
  link: { marginTop: space.xl },
});
