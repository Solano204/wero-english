import React, { memo } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card, Presionable } from '@/shared/ui';
import { GrupoAudio } from '@/shared/ui/GrupoAudio';
import { useAudioFrase } from '@/shared/hooks/useAudioFrase';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { etiquetaFallos, tamanoAtorada } from '@/domain/atoradas';
import { aparecerSubiendo, color, escalon, font, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Entry } from '@/types';
import { MedidorAtasco } from './MedidorAtasco';

interface Props {
  entry: Entry;
  fallos: number;
  /** Posición en la lista, para la entrada escalonada. */
  indice: number;
  /** Solo las primeras de una lista entran animadas; el resto aparece directo. */
  animar: boolean;
  onAbrir: (entry: Entry) => void;
}

/**
 * Una frase atorada como una sola tarjeta con todo adentro: la frase con karaoke (tocarla la reproduce), su traducción en
 * `textMuted`, el grupo segmentado Inglés · Español y, a la derecha, el medidor de atasco con «N fallos» debajo. Las que
 * llenan el medidor (5 fallos o más) van más grandes (la frase en `md` y los puntos más grandes) y, como la lista viene
 * ordenada por fallos, arriba (IA-2). Tocar fuera de los controles abre el Detalle. Para el lector de pantalla es un botón
 * que dice la frase, su traducción y sus fallos, con las acciones «Escuchar en inglés» y «Escuchar en español». Sin
 * cronómetro y sin calificación: aquí solo se lee y se escucha. La entrada va en un `Animated.View` aparte porque
 * `Presionable` anima su propia escala.
 */
export const TarjetaAtorada = memo(function TarjetaAtorada({ entry, fallos, indice, animar, onAbrir }: Props) {
  const reducido = useMovimientoReducido();
  const { vozEn, palabras, controles, sonar, acciones, atender } = useAudioFrase(entry);
  const tamano = tamanoAtorada(fallos);
  const abrir = () => onAbrir(entry);
  const alAccion = (e: AccessibilityActionEvent) => {
    atender(e.nativeEvent.actionName);
  };

  return (
    <Animated.View entering={animar && !reducido ? aparecerSubiendo(escalon(indice)) : undefined}>
      <Presionable
        onPress={abrir}
        accessibilityRole="button"
        accessibilityLabel={`${entry.phrase}. ${entry.spanish_main}. ${etiquetaFallos(fallos)}`}
        accessibilityHint="Abre la frase"
        accessibilityActions={acciones}
        onAccessibilityAction={alAccion}
      >
        <Card enLista>
          <View style={styles.fila}>
            <View style={styles.textos}>
              <Presionable
                onPress={() => sonar(entry.audio_en)}
                accessibilityRole="button"
                accessibilityLabel={entry.phrase}
                accessibilityHint="Escuchar en inglés"
                style={styles.frase}
              >
                <FraseKaraoke palabras={palabras} voz={vozEn} tamano={tamano === 'grande' ? 'md' : 'h3'} alinear="inicio" />
              </Presionable>
              <Text style={styles.traduccion}>{entry.spanish_main}</Text>
              <GrupoAudio controles={controles} alSonar={sonar} />
            </View>
            <MedidorAtasco fallos={fallos} tamano={tamano} />
          </View>
        </Card>
      </Presionable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  textos: { flex: 1, gap: space.sm },
  frase: { alignSelf: 'stretch' },
  traduccion: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
});
