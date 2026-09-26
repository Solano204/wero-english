import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Card, Presionable } from '@/components/base';
import { GrupoAudio, type ControlAudio } from '@/components/card/GrupoAudio';
import { FraseKaraoke, useVozEnVivo, useVozFrase } from '@/components/fx';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, layout, motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { GramaticaTema } from '@/types';

type Ejemplo = GramaticaTema['ejemplos'][number];

interface Props {
  ejemplo: Ejemplo;
  /** Es el ejemplo que suena dentro de «Escuchar todos». */
  activo: boolean;
  /** Corre justo antes de pedir un audio suelto: suelta la secuencia de «Escuchar todos», sin cortar nada por su cuenta. */
  antes: () => void;
  /** Avisa una vez, cuando el ejemplo pasa a ser el activo, con la vista de su tarjeta (para llevarla a la pantalla). */
  alActivarse: (vista: View | null) => void;
}

/**
 * Un ejemplo de «Así se dice» como tarjeta: la frase en inglés con karaoke (tocarla la reproduce), su traducción y un
 * grupo segmentado de tres controles del mismo alto (Inglés, Lento, Español). Mientras suena algo de este ejemplo, o
 * cuando lo enciende «Escuchar todos», la tarjeta lleva un filo de `accent` con un velo `accentSoft`; el karaoke sigue
 * la voz que suena, la natural o la lenta (son audios distintos). Con «reducir movimiento» el filo cambia sin fundido
 * y el karaoke solo cambia de color.
 */
export function EjemploFrase({ ejemplo, activo, antes, alActivarse }: Props) {
  const reducido = useMovimientoReducido();
  const vista = useRef<View>(null);
  const { voz, palabras, sonandoNormal, sonandoLenta } = useVozFrase(ejemplo.en, ejemplo.audio, ejemplo.audio_lento);
  const vozEs = useVozEnVivo(ejemplo.audio_es || null);

  const suena = activo || sonandoNormal || sonandoLenta || vozEs.sonando;
  const luz = useSharedValue(0);
  useEffect(() => {
    const destino = suena ? 1 : 0;
    if (reducido) {
      luz.value = destino;
      return;
    }
    luz.value = withTiming(destino, { duration: motionDuration.base, easing: motionEasing.entrar });
    return () => cancelAnimation(luz);
  }, [suena, reducido, luz]);
  const estiloFilo = useAnimatedStyle(() => ({ opacity: luz.value }));

  const alActivarseRef = useRef(alActivarse);
  alActivarseRef.current = alActivarse;
  useEffect(() => {
    if (activo) alActivarseRef.current(vista.current);
  }, [activo]);

  const sonar = (ruta: string, lento: boolean) => {
    antes();
    haptics.tapLight();
    void (lento ? audio.playSlow(ruta) : audio.play(ruta));
  };

  const controles: ControlAudio[] = [
    { clave: 'en', etiqueta: 'Inglés', descripcion: 'Escuchar en inglés', icono: 'play', ruta: ejemplo.audio, lento: false, suena: sonandoNormal },
    { clave: 'lento', etiqueta: 'Lento', descripcion: 'Escuchar lento', icono: 'slow', ruta: ejemplo.audio_lento, lento: true, suena: sonandoLenta },
  ];
  if (ejemplo.audio_es) {
    controles.push({ clave: 'es', etiqueta: 'Español', descripcion: 'Escuchar en español', icono: 'play', ruta: ejemplo.audio_es, lento: false, suena: vozEs.sonando });
  }

  return (
    <View ref={vista} collapsable={false}>
      <Card>
        <Animated.View style={[StyleSheet.absoluteFill, styles.filo, estiloFilo]} pointerEvents="none" />
        <Presionable
          onPress={() => sonar(ejemplo.audio, false)}
          accessibilityRole="button"
          accessibilityLabel={ejemplo.en}
          accessibilityHint="Escuchar la frase en inglés"
          style={styles.frase}
        >
          <FraseKaraoke palabras={palabras} voz={voz} tamano="h3" alinear="inicio" apagada={vozEs.sonando} />
        </Presionable>
        <Text style={[styles.traduccion, vozEs.sonando && styles.traduccionSuena]}>{ejemplo.es}</Text>
        <GrupoAudio controles={controles} alSonar={sonar} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  filo: { borderWidth: 1.5, borderColor: color.accent, backgroundColor: color.accentSoft },
  frase: { minHeight: layout.tapMin, justifyContent: 'center' },
  traduccion: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  traduccionSuena: { color: color.text },
});
