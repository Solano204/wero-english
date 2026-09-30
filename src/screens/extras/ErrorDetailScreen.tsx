import React, { useCallback, useMemo, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, Header, NotaInfo, Screen } from '@/components/base';
import { DueloContraste } from '@/components/errores/DueloContraste';
import { MedidorGravedad } from '@/components/errores/MedidorGravedad';
import { SecuenciaMalentendido } from '@/components/errores/SecuenciaMalentendido';
import { textoParaCompartir } from '@/domain/errores';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import { loadContent } from '@/store/content';
import { color, font, motionMalentendido, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Rt = RouteProp<RootStackParams, 'ErrorDetail'>;

/**
 * Ficha de un error. Arriba, la señal que se rompe: lo que dices, lo que entienden y lo correcto en tres pasos. Los de
 * pronunciación traen el duelo «Así suena mal» contra «Así suena bien». Después, por qué pasa, la gravedad (con su texto,
 * en ámbar) y, si se puede contar, «Para contar» y el botón «Compartir», que abre el menú del sistema con un texto armado.
 */
export function ErrorDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const content = useMemo(loadContent, []);
  const [falloCompartir, setFalloCompartir] = useState(false);

  const err = content.errores.errores.find((e) => e.id === params.errorId);

  // Perder el foco (salir, abrir la frase completa) corta todo el audio: el reproductor de frases es uno solo y compartido.
  useCortarAudioAlSalir();

  const compartir = useCallback(async () => {
    if (!err) return;
    setFalloCompartir(false);
    try {
      await Share.share({ message: textoParaCompartir(err) });
    } catch {
      setFalloCompartir(true);
    }
  }, [err]);

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

      <DueloContraste error={err} />

      <View style={styles.why}>
        <Text style={styles.whyHead}>Por qué pasa</Text>
        <NotaInfo>
          <Text style={styles.whyBody}>{err.por_que}</Text>
        </NotaInfo>
      </View>

      <View style={styles.tags}>
        {/* Las barras se encienden cuando termina la secuencia de arriba. */}
        <MedidorGravedad gravedad={err.gravedad} disposicion="fila" animado retraso={motionMalentendido.tope} />
        {err.compartible ? <Badge label="Para contar" tone="accent" small /> : null}
      </View>

      {err.compartible ? (
        <View style={styles.compartir}>
          <Button variant="secondary" icon="share" label="Compartir" onPress={compartir} full />
          {falloCompartir ? <Text style={styles.aviso}>No se pudo abrir el menú de compartir. Intenta otra vez.</Text> : null}
        </View>
      ) : null}

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
  compartir: { marginTop: space.lg, gap: space.sm },
  aviso: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.wrong },
  link: { marginTop: space.xl },
});
