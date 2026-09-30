import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AudioButton } from '@/shared/ui/AudioButton';
import { PhraseBlock } from './PhraseBlock';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { OndaVoz } from '@/shared/ui/fx/OndaVoz';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import { color, font, space } from '@/theme';
import type { Entry } from '@/types';

const ALTO_ONDA = 40;
const ALTO_ONDA_COMPACTA = 32;
const ALTO_ONDA_GRANDE = 104;
const ALTO_ONDA_GRANDE_COMPACTA = 80;

interface Props {
  entry: Entry;
  /**
   * frase: la frase con karaoke, su IPA y los botones de audio (Reconocer).
   * oido: sin texto, la onda grande y «Otra vez» debajo (Escuchar y Dictado).
   * pista: el texto en español que se muestra y el botón para oírla en inglés (Construir).
   */
  variante: 'frase' | 'oido' | 'pista';
  pista?: string;
  dictado?: boolean;
  compacto: boolean;
}

/**
 * La voz de la tarjeta: onda encima y, según el ejercicio, la frase con
 * karaoke o solo los botones. Aquí vive el héroe de Estudio («la frase es
 * señal»); el audio lo disparan los botones y la tarjeta como siempre, esto
 * solo mira cuándo suena.
 */
export function BloqueVoz({ entry, variante, pista, dictado = false, compacto }: Props) {
  const voz = useVozEnVivo(entry.audio_en);
  // Lo que se dice puede diferir de lo que se ve; los tiempos se calculan sobre lo dicho.
  const hablado = entry.phrase_tts || entry.phrase;
  const analisis = useMemo(
    () => analizar(variante === 'frase' ? entry.phrase : hablado, hablado, marcasDe(entry.audio_en), voz.duracion),
    [variante, entry.phrase, hablado, entry.audio_en, voz.duracion]
  );

  if (variante === 'oido') {
    return (
      <View style={styles.oido}>
        <OndaVoz voz={voz} envolvente={analisis.envolvente} alto={compacto ? ALTO_ONDA_GRANDE_COMPACTA : ALTO_ONDA_GRANDE} />
        <View style={styles.botones}>
          <AudioButton path={entry.audio_en} size="lg" label="Otra vez" />
          <AudioButton path={entry.audio_en} size="md" slow label="Más lento" />
        </View>
        {dictado ? <Text style={styles.hintLine}>No hay texto. Dale las veces que quieras.</Text> : null}
      </View>
    );
  }

  const onda = <OndaVoz voz={voz} envolvente={analisis.envolvente} alto={compacto ? ALTO_ONDA_COMPACTA : ALTO_ONDA} />;

  if (variante === 'pista') {
    return (
      <View style={[styles.frase, compacto && styles.fraseCompacta]}>
        {onda}
        <Text style={styles.spanishPrompt}>{pista}</Text>
        <AudioButton path={entry.audio_en} size="md" label="Escuchar" />
      </View>
    );
  }

  return (
    <View style={[styles.frase, compacto && styles.fraseCompacta]}>
      {onda}
      <PhraseBlock entry={entry} frase={<FraseKaraoke palabras={analisis.palabras} voz={voz} />} />
    </View>
  );
}

const styles = StyleSheet.create({
  frase: { alignSelf: 'stretch', alignItems: 'center', gap: space.md },
  fraseCompacta: { gap: space.sm },
  // Sin texto que leer, la onda manda: ocupa el centro del bloque y los botones cuelgan de ella.
  oido: { flexGrow: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: space.md },
  botones: { alignItems: 'center', gap: space.sm },
  hintLine: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
  },
  spanishPrompt: {
    fontSize: font.size.xl,
    color: color.text,
    textAlign: 'center',
    lineHeight: font.size.xl * 1.35,
    fontFamily: font.family.body,
  },
});
