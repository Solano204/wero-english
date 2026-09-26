import React, { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Card, Icon, Presionable } from '@/components/base';
import { GrupoAudio, type ControlAudio } from '@/components/card/GrupoAudio';
import { FraseKaraoke, useVozEnVivo } from '@/components/fx';
import { analizar } from '@/domain/marcas';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { marcasDe } from '@/services/marcas';
import { aparecer, aparecerSubiendo, color, escalon, font, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { Entry } from '@/types';
import { DeslizarQuitar } from './DeslizarQuitar';

interface Props {
  entry: Entry;
  /** Posición en la lista, para la entrada escalonada. */
  indice: number;
  /** Solo las primeras de una lista entran animadas; el resto aparece directo. */
  animar: boolean;
  onAbrir: (entry: Entry) => void;
  /** Quitar la frase de Mi mazo: el deslizamiento, el botón que sale al mantener presionado y la acción del lector. */
  onQuitar: (entry: Entry) => void;
}

/**
 * Una frase guardada en Mi mazo, como una sola tarjeta: la frase en h3 con karaoke (tocarla la reproduce), su traducción
 * en `textMuted` y el grupo segmentado Inglés · Español, el mismo de Gramática y Phrasal. El chevron dice que toda la
 * tarjeta abre el Detalle; tocar un control de audio o la frase no lo abre. Deslizarla a la izquierda la quita
 * (`DeslizarQuitar`); mantenerla presionada muestra un botón «Quitar de mi mazo» visible; para el lector de pantalla son
 * las acciones «Quitar de mi mazo», «Escuchar en inglés» y «Escuchar en español». La entrada va en un `Animated.View`
 * aparte porque `Presionable` anima su propia escala al presionar.
 */
export const TarjetaGuardada = memo(function TarjetaGuardada({ entry, indice, animar, onAbrir, onQuitar }: Props) {
  const reducido = useMovimientoReducido();
  const vozEn = useVozEnVivo(entry.audio_en);
  const vozEs = useVozEnVivo(entry.audio_es);
  const [verQuitar, setVerQuitar] = useState(false);
  const hablado = entry.phrase_tts || entry.phrase;
  const { palabras } = useMemo(
    () => analizar(entry.phrase, hablado, marcasDe(entry.audio_en), vozEn.duracion),
    [entry.phrase, hablado, entry.audio_en, vozEn.duracion]
  );

  const abrir = useCallback(() => onAbrir(entry), [onAbrir, entry]);
  const quitar = useCallback(() => onQuitar(entry), [onQuitar, entry]);
  const sonar = useCallback((ruta: string) => {
    haptics.tapLight();
    void audio.play(ruta);
  }, []);
  const alMantener = useCallback(() => {
    haptics.tapMedium();
    setVerQuitar((v) => !v);
  }, []);

  const controles: ControlAudio[] = [
    { clave: 'en', etiqueta: 'Inglés', descripcion: 'Escuchar en inglés', icono: 'play', ruta: entry.audio_en, lento: false, suena: vozEn.sonando },
    ...(entry.audio_es
      ? [{ clave: 'es', etiqueta: 'Español', descripcion: 'Escuchar en español', icono: 'play' as const, ruta: entry.audio_es, lento: false, suena: vozEs.sonando }]
      : []),
  ];
  const acciones = [
    { name: 'quitar', label: 'Quitar de mi mazo' },
    { name: 'ingles', label: 'Escuchar en inglés' },
    ...(entry.audio_es ? [{ name: 'espanol', label: 'Escuchar en español' }] : []),
  ];
  const alAccion = (e: AccessibilityActionEvent) => {
    const nombre = e.nativeEvent.actionName;
    if (nombre === 'quitar') quitar();
    else if (nombre === 'ingles') sonar(entry.audio_en);
    else if (nombre === 'espanol' && entry.audio_es) sonar(entry.audio_es);
  };

  return (
    <Animated.View entering={animar && !reducido ? aparecerSubiendo(escalon(indice)) : undefined}>
      <DeslizarQuitar onQuitar={quitar}>
        <Presionable
          onPress={abrir}
          onLongPress={alMantener}
          accessibilityRole="button"
          accessibilityLabel={`${entry.phrase}. ${entry.spanish_main}`}
          accessibilityHint="Abre la frase"
          accessibilityActions={acciones}
          onAccessibilityAction={alAccion}
        >
          <Card>
            <View style={styles.fila}>
              <View style={styles.textos}>
                <Presionable
                  onPress={() => sonar(entry.audio_en)}
                  accessibilityRole="button"
                  accessibilityLabel={entry.phrase}
                  accessibilityHint="Escuchar en inglés"
                  style={styles.frase}
                >
                  <FraseKaraoke palabras={palabras} voz={vozEn} tamano="h3" alinear="inicio" />
                </Presionable>
                <Text style={styles.traduccion}>{entry.spanish_main}</Text>
                <GrupoAudio controles={controles} alSonar={sonar} />
                {verQuitar ? (
                  <Animated.View entering={reducido ? undefined : aparecer()} style={styles.quitar}>
                    <Button variant="ghost" icon="star" label="Quitar de mi mazo" onPress={quitar} />
                  </Animated.View>
                ) : null}
              </View>
              <Icon name="chevron-right" size="md" color={color.textFaint} />
            </View>
          </Card>
        </Presionable>
      </DeslizarQuitar>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  textos: { flex: 1, gap: space.sm },
  frase: { alignSelf: 'stretch' },
  quitar: { alignSelf: 'flex-start' },
  traduccion: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
});
