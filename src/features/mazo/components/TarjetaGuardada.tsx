import React, { memo, useState } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Card, Icon, Presionable } from '@/shared/ui';
import { GrupoAudio } from '@/shared/ui/GrupoAudio';
import { useAudioFrase } from '@/shared/hooks/useAudioFrase';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import * as haptics from '@/services/haptics';
import { aparecer, aparecerSubiendo, color, escalon, font, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
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
  const { vozEn, palabras, controles, sonar, acciones, atender } = useAudioFrase(entry);
  const [verQuitar, setVerQuitar] = useState(false);

  const abrir = () => onAbrir(entry);
  const quitar = () => onQuitar(entry);
  const alMantener = () => {
    haptics.tapMedium();
    setVerQuitar((v) => !v);
  };
  const alAccion = (e: AccessibilityActionEvent) => {
    const nombre = e.nativeEvent.actionName;
    if (nombre === 'quitar') quitar();
    else atender(nombre);
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
          accessibilityActions={[{ name: 'quitar', label: 'Quitar de mi mazo' }, ...acciones]}
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
