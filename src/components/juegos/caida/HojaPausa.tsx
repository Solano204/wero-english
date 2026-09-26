import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/base/Button';
import { Icon } from '@/components/base/Icon';
import { FraseKaraoke, useVozEnVivo } from '@/components/fx';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import {
  color,
  filoOk,
  filoWrong,
  font,
  motionDuration,
  motionEasing,
  motionSpring,
  radius,
  sol,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/utils';
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
  const reducido = useMovimientoReducido();
  const { height: alturaVentana } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  // Al irse, la hoja se lleva su contenido: no se vacía a media salida.
  const ultimo = useRef<Contenido | null>(null);
  if (entry && (ultimo.current?.entry !== entry || ultimo.current.correct !== correct)) {
    ultimo.current = { entry, correct };
  }
  const c = ultimo.current;

  const vozEn = useVozEnVivo(c?.entry.audio_en ?? null);
  const vozEs = useVozEnVivo(c?.entry.audio_es ?? null);
  const activaEs = vozEs.activa;
  const en = useMemo(
    () =>
      c
        ? // Lo que se dice puede diferir de lo que se ve; los tiempos se calculan sobre lo dicho.
          analizar(c.entry.phrase, c.entry.phrase_tts || c.entry.phrase, marcasDe(c.entry.audio_en), vozEn.duracion)
        : null,
    [c, vozEn.duracion]
  );

  const y = useSharedValue(alturaVentana);
  const opacidad = useSharedValue(reducido ? 0 : 1);

  useEffect(() => {
    if (visible) {
      if (reducido) {
        y.value = 0;
        opacidad.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
      } else {
        opacidad.value = 1;
        y.value = withSpring(0, motionSpring.rebote);
      }
    } else if (reducido) {
      opacidad.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });
    } else {
      y.value = withTiming(alturaVentana, { duration: motionDuration.rapido, easing: motionEasing.salir });
    }
  }, [visible, reducido, alturaVentana, y, opacidad]);

  const hoja = useAnimatedStyle(() => ({ opacity: opacidad.value, transform: [{ translateY: y.value }] }));
  // La traducción se enciende mientras suena el español.
  const traduccion = useAnimatedStyle(() => ({ color: interpolateColor(activaEs.value, [0, 1], [TENUE, ENCENDIDA]) }));

  if (!c || !en) return null;

  const ok = c.correct;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'box-none' : 'none'}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!visible}
    >
      <Animated.View style={[styles.hoja, hoja]}>
        <LinearGradient colors={ok ? filoOk : filoWrong} start={sol.start} end={sol.end} style={styles.filo}>
          <View
            style={[styles.contenido, ok ? styles.ok : styles.mal, { paddingBottom: bottom + space.lg }]}
            accessibilityLiveRegion="polite"
          >
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
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hoja: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // El filo de luz de 1 px, solo arriba: la hoja se apoya en el borde de la pantalla.
  filo: {
    padding: 1,
    paddingBottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  contenido: {
    alignItems: 'center',
    padding: space.lg,
    gap: space.sm,
    borderTopLeftRadius: radius.xl - 1,
    borderTopRightRadius: radius.xl - 1,
    overflow: 'hidden',
  },
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
