import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Badge, Card, Presionable } from '@/components/base';
import { MarcoImagen } from '@/components/card';
import { GrupoAudio, type ControlAudio } from '@/components/card/GrupoAudio';
import { FraseKaraoke, useVozEnVivo } from '@/components/fx';
import { analizar } from '@/domain/marcas';
import { DENSIDAD, alturaEstimada, alturaImagen, desborda, elegirDensidad, tamanoFrase } from '@/domain/mazo';
import { marcasDe } from '@/services/marcas';
import { color, font, space, type WorldId } from '@/theme';
import type { Entry } from '@/types';

/** Qué botón sonó: el inglés, el inglés lento, el español, o el inglés y luego el español. */
export type Modo = 'en' | 'lento' | 'es' | 'ambos';
/** Lo que suena ahora: por qué botón se pidió y qué texto se está diciendo. */
export interface Sonando {
  modo: Modo;
  lengua: 'en' | 'es';
}

interface Props {
  entry: Entry;
  /** La carta de arriba: la única con voz, karaoke y controles. Las de atrás son la misma carta, quieta y sin escuchar. */
  activa: boolean;
  /** Alto de la carta y ancho que le queda a su texto, en dp: de ellos sale cuánto aire y cuánto texto lleva. */
  alto: number;
  ancho: number;
  sonando: Sonando | null;
  onSonar: (modo: Modo) => void;
  guardada: boolean;
  /** Las acciones del lector de pantalla: el deslizamiento nunca es la única forma de hacer algo. */
  onSiguiente: () => void;
  onGuardar: () => void;
}

/**
 * La carta de una frase suelta, de alto fijo y sin scroll (un scroll vertical pelearía con «deslizar arriba»). Arriba,
 * si sobra lugar, una franja de imagen; sin imagen no se reserva nada. Debajo, la frase en `text` con karaoke (tocarla la
 * reproduce) y su IPA centrado, el grupo Escuchar · Lento, la traducción con su grupo Español · Inglés y español, el aviso
 * de vulgaridad y la nota. Según el largo de la frase la carta elige entre tres densidades (`elegirDensidad`): con más o
 * menos aire y renglones; lo que se corta con «…» lo oye entero el lector de pantalla. Para él la frase con su IPA es un
 * botón que ofrece las acciones «Siguiente» y «Guardar».
 */
export function CartaFrase({ entry, activa, alto, ancho, sonando, onSonar, guardada, onSiguiente, onGuardar }: Props) {
  const voz = useVozEnVivo(activa ? entry.audio_en : null);
  const hablado = entry.phrase_tts || entry.phrase;
  const { palabras } = useMemo(
    () => analizar(entry.phrase, hablado, marcasDe(entry.audio_en), voz.duracion),
    [entry.phrase, hablado, entry.audio_en, voz.duracion]
  );

  const densidad = useMemo(() => elegirDensidad(entry, ancho, alto), [entry, ancho, alto]);
  const d = DENSIDAD[densidad];
  // El marco de imagen (16:9 al ancho de la carta) siempre se reserva, con imagen o sin ella. Si aun en la
  // densidad más apretada el contenido no cabe (frase muy larga, con nota), la carta deja hacer scroll: es la
  // excepción, no la norma, así que no compite con el deslizamiento de "Siguiente"/"Guardar" casi nunca.
  const altoImagen = alturaImagen(ancho);
  const seDesborda = useMemo(
    () => desborda(alto, alturaEstimada(entry, ancho, densidad)),
    [entry, ancho, alto, densidad]
  );
  const tinte = color.world[entry.mundo as WorldId];

  const grupoFrase: ControlAudio[] = [
    { clave: 'en', etiqueta: 'Escuchar', descripcion: 'Escuchar la frase en inglés', icono: 'volume', ruta: entry.audio_en, lento: false, suena: sonando?.modo === 'en' },
    { clave: 'lento', etiqueta: 'Lento', descripcion: 'Escuchar la frase despacio', icono: 'slow', ruta: entry.audio_en, lento: true, suena: sonando?.modo === 'lento' },
  ];
  const grupoEs: ControlAudio[] = [
    { clave: 'es', etiqueta: 'Español', descripcion: 'Escuchar la traducción en español', icono: 'volume', ruta: entry.audio_es ?? '', lento: false, suena: sonando?.modo === 'es' },
    { clave: 'ambos', etiqueta: 'Inglés y español', descripcion: 'Escuchar la frase en inglés y después la traducción en español', icono: 'play', ruta: entry.audio_en, lento: false, suena: sonando?.modo === 'ambos' },
  ];

  const acciones = [
    { name: 'siguiente', label: 'Siguiente' },
    { name: 'guardar', label: guardada ? 'Quitar de Mi mazo' : 'Guardar' },
  ];
  const alAccion = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'siguiente') onSiguiente();
    else if (e.nativeEvent.actionName === 'guardar') onGuardar();
  };

  return (
    <Card llena compacta={densidad !== 'normal'} style={{ height: alto }}>
      <View style={styles.marcoZona}>
        <MarcoImagen path={entry.imagen} tinte={tinte} mundo={entry.mundo} ancho={ancho} alto={altoImagen} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.cuerpo, { gap: d.aire }]}
        scrollEnabled={seDesborda}
        bounces={seDesborda}
        showsVerticalScrollIndicator={false}
      >
        <Presionable
          onPress={() => onSonar('en')}
          disabled={!activa}
          accessibilityRole="button"
          accessibilityLabel={entry.ipa ? `${entry.phrase}. ${entry.ipa}` : entry.phrase}
          accessibilityHint="Escuchar la frase en inglés"
          accessibilityActions={acciones}
          onAccessibilityAction={alAccion}
          style={styles.frase}
        >
          <FraseKaraoke palabras={palabras} voz={voz} tamano={tamanoFrase(entry.phrase.length, densidad)} />
          {entry.ipa ? (
            <Text style={styles.ipa} numberOfLines={d.ipa}>
              {entry.ipa}
            </Text>
          ) : null}
        </Presionable>

        <GrupoAudio alinear="centro" controles={grupoFrase} alSonar={(_, lento) => onSonar(lento ? 'lento' : 'en')} />

        <Text style={[styles.traduccion, sonando?.lengua === 'es' && styles.traduccionSuena]} numberOfLines={d.traduccion}>
          {entry.spanish_main}
        </Text>

        <GrupoAudio
          alinear="centro"
          controles={grupoEs}
          alSonar={(ruta) => onSonar(ruta === entry.audio_es ? 'es' : 'ambos')}
        />

        {entry.vulgaridad === 2 ? (
          <Badge label="Fuerte" tone="strong" />
        ) : entry.vulgaridad === 1 ? (
          <Badge label="Cuidado" tone="warn" />
        ) : null}

        {entry.note && d.nota > 0 ? (
          <Text style={styles.nota} numberOfLines={d.nota}>
            {entry.note}
          </Text>
        ) : null}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  marcoZona: { marginBottom: space.sm },
  scroll: { flex: 1 },
  cuerpo: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  frase: { alignItems: 'center', gap: space.sm },
  // El IPA va centrado aquí y no en la tarjeta: `Card` no aplica a su contenido el `alignItems` que se le pase.
  ipa: {
    fontFamily: font.family.ipa,
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  traduccion: {
    fontFamily: font.family.body,
    fontSize: font.size.lg,
    lineHeight: font.size.lg * 1.4,
    color: color.textMuted,
    textAlign: 'center',
  },
  traduccionSuena: { color: color.text },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    textAlign: 'center',
  },
});
