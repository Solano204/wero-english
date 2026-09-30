import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Button } from '@/shared/ui/Button';
import { Hoja } from '@/shared/ui/Hoja';
import { Icon } from '@/shared/ui/Icon';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import {
  color,
  filoOk,
  filoWrong,
  font,
  space,
} from '@/theme';
import { useUltimo } from '@/shared/hooks/useUltimo';
import type { Entry } from '@/types';

// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const TENUE = color.textMuted;
const ENCENDIDA = color.text;

interface Contenido {
  entry: Entry;
  correct: boolean;
}

interface Props {
  /** La frase de la ronda que acaba de terminar; `null` cuando no hay pausa. */
  entry: Entry | null;
  /** Se acertó (filo y fondo verdes, `check`) o no (ámbar, `close`): nunca rojo. */
  correct: boolean;
  /** La hoja sube (o baja) cuando la animación del final de la ronda ya se vio. */
  visible: boolean;
  /** Un salto ya está en curso: comparte el candado de «Siguiente». */
  avanzando: boolean;
  /** «Siguiente»: corta la voz y avanza ya. */
  onContinuar: () => void;
}

/**
 * La pausa de fin de ronda, en la zona del pulgar: una hoja compacta que sube desde abajo (como la de
 * Estudio, sin velo negro) con la frase en inglés en karaoke sincronizado con el audio y, debajo, la
 * traducción, que se enciende cuando suena el español. «Siguiente» va abajo con su texto y conserva su
 * comportamiento (corta la voz y avanza; el mismo candado contra doble toque).
 *
 * Escucha la voz desde que hay frase, aunque la hoja aún no haya subido: el audio arranca al contestar y
 * no espera a la animación. La reproducción, sus topes y el paso a la ronda siguiente viven en la pantalla.
 * Con «reducir movimiento» no sube: aparece con un fundido; el karaoke cambia de color igual.
 */
export function HojaPausa({ entry, correct, visible, avanzando, onContinuar }: Props) {

  // Al irse, la hoja se lleva su contenido: no se vacía a media salida.
  const c = useUltimo<Contenido>(entry ? { entry, correct } : null, (a, b) => a.entry === b.entry && a.correct === b.correct);

  const vozEn = useVozEnVivo(c?.entry.audio_en ?? null);
  const vozEs = useVozEnVivo(c?.entry.audio_es ?? null);
  const activaEs = vozEs.activa;
  const en = (c
        ? // Lo que se dice puede diferir de lo que se ve; los tiempos se calculan sobre lo dicho.
          analizar(c.entry.phrase, c.entry.phrase_tts || c.entry.phrase, marcasDe(c.entry.audio_en), vozEn.duracion)
        : null);

  // La traducción se enciende mientras suena el español.
  const traduccion = useAnimatedStyle(() => ({ color: interpolateColor(activaEs.get(), [0, 1], [TENUE, ENCENDIDA]) }));

  if (!c || !en) return null;

  const ok = c.correct;
  return (
    <Hoja visible={visible} filo={ok ? filoOk : filoWrong} estiloCuerpo={[styles.contenido, ok ? styles.ok : styles.mal]}>
      <Icon name={ok ? 'check' : 'close'} size="md" color={ok ? color.correct : color.wrong} />
      <FraseKaraoke palabras={en.palabras} voz={vozEn} tamano="md" />
      <Animated.Text style={[styles.traduccion, traduccion]}>{c.entry.spanish_main}</Animated.Text>
      <Button
        label="Siguiente"
        icon="arrow-right"
        iconAlFinal
        size="lg"
        disabled={avanzando}
        onPress={onContinuar}
        full
      />
    </Hoja>
  );
}

const styles = StyleSheet.create({
  contenido: { alignItems: 'center', padding: space.lg, gap: space.sm },
  ok: { backgroundColor: color.correctFondo },
  mal: { backgroundColor: color.wrongFondo },
  traduccion: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    textAlign: 'center',
    marginBottom: space.sm,
  },
});
