import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AudioButton } from '@/shared/ui/AudioButton';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { OndaVoz } from '@/shared/ui/fx/OndaVoz';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import { color, font, space } from '@/theme';
import type { Entry } from '@/types';
import { NotaPlegable } from './NotaPlegable';

const ALTO_ONDA = 48;

interface Props {
  entry: Entry;
}

/**
 * El héroe de Detalle: la frase en display con karaoke, su IPA y la onda de la voz
 * en reposo; Escuchar y Lento la encienden. Debajo, la traducción principal con su
 * propio audio en español, y al sonar el español la onda pasa a `textMuted` para
 * distinguir los dos idiomas sin otro color de marca. Los tiempos de palabra son
 * los mismos que en Estudio (marcas de Polly o estimación por sílabas); la onda del
 * español siempre sale de una estimación.
 */
export function HeroeFrase({ entry }: Props) {
  const vozEn = useVozEnVivo(entry.audio_en);
  const vozEs = useVozEnVivo(entry.audio_es);
  // Lo que se dice puede diferir de lo que se ve; los tiempos se calculan sobre lo dicho.
  const hablado = entry.phrase_tts || entry.phrase;

  const en = useMemo(
    () => analizar(entry.phrase, hablado, marcasDe(entry.audio_en), vozEn.duracion),
    [entry.phrase, hablado, entry.audio_en, vozEn.duracion]
  );
  const es = useMemo(
    () => analizar(entry.spanish_main, entry.spanish_main, undefined, vozEs.duracion),
    [entry.spanish_main, vozEs.duracion]
  );

  // Si el inglés arranca mientras el español se apaga, manda el inglés.
  const hablaEs = vozEs.sonando && !vozEn.sonando;

  return (
    <View style={styles.wrap}>
      <FraseKaraoke palabras={en.palabras} voz={vozEn} tamano="display" />

      {entry.ipa ? <Text style={styles.ipa}>{entry.ipa}</Text> : null}

      <OndaVoz
        voz={hablaEs ? vozEs : vozEn}
        envolvente={hablaEs ? es.envolvente : en.envolvente}
        alto={ALTO_ONDA}
        tono={hablaEs ? 'neutro' : 'senal'}
      />

      <View style={styles.botones}>
        <AudioButton path={entry.audio_en} size="md" label="Escuchar" />
        <AudioButton path={entry.audio_en} size="md" slow label="Lento" />
      </View>

      <View style={styles.traduccion}>
        <Text style={styles.spanish}>{entry.spanish_main}</Text>
        {entry.audio_es ? <AudioButton path={entry.audio_es} size="md" /> : null}
      </View>

      {entry.ipa_note ? <NotaPlegable titulo="Cómo se pronuncia" nota={entry.ipa_note} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  ipa: {
    fontFamily: font.family.ipa,
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  botones: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  traduccion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.sm },
  spanish: {
    flexShrink: 1,
    fontFamily: font.family.body,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.35,
    color: color.textMuted,
    textAlign: 'center',
  },
});
