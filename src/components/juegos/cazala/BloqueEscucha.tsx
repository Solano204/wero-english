import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card } from '@/components/base';
import { AudioButton } from '@/components/card';
import { OndaVoz, type VozEnVivo } from '@/components/fx';
import { color, desaparecer, font, motionDuration, reacomodar, space } from '@/theme';

const ALTO_ONDA = 32;

interface Props {
  audio: string;
  audioLento: string;
  voz: VozEnVivo;
  vozLenta: VozEnVivo;
  /** La energía de la voz natural y la de la lenta (`analizar().envolvente`). */
  envolvente: number[];
  envolventeLenta: number[];
  /** Teléfono de poco alto: la onda va al lado de los botones y la tarjeta se aprieta. */
  compacta: boolean;
  /** La instrucción se va al revisar: ya no hace falta y el resultado necesita ese lugar. */
  conInstruccion: boolean;
}

/**
 * La tarjeta de audio de Cázala: la instrucción, Escuchar y Lento del mismo tamaño y la onda de la frase, que
 * sube con la voz que suena (la natural o la lenta) y se aplana al terminar. El audio lo reproducen los botones;
 * aquí solo se ve.
 */
export function BloqueEscucha({
  audio,
  audioLento,
  voz,
  vozLenta,
  envolvente,
  envolventeLenta,
  compacta,
  conInstruccion,
}: Props) {
  const lenta = vozLenta.sonando;
  const onda = (
    <View
      style={compacta ? styles.ondaLado : styles.onda}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <OndaVoz voz={lenta ? vozLenta : voz} envolvente={lenta ? envolventeLenta : envolvente} alto={ALTO_ONDA} />
    </View>
  );

  return (
    <Animated.View layout={reacomodar()}>
      <Card compacta>
        {conInstruccion ? (
          <Animated.Text exiting={desaparecer(motionDuration.rapido)} style={styles.instruccion}>
            Escucha y marca las tres reducciones que oíste
          </Animated.Text>
        ) : null}
        <View style={styles.fila}>
          <AudioButton path={audio} size="md" label="Escuchar" />
          <AudioButton path={audioLento} size="md" slow label="Lento" />
          {compacta ? onda : null}
        </View>
        {compacta ? null : onda}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  instruccion: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.4,
    color: color.textMuted,
    textAlign: 'center',
  },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  onda: { height: ALTO_ONDA, alignSelf: 'stretch' },
  ondaLado: { flex: 1, minWidth: 48, height: ALTO_ONDA },
});
