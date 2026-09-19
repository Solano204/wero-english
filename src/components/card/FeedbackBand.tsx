import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button } from '@/components/base';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  color,
  filoOk,
  filoWrong,
  font,
  motionDuration,
  motionEasing,
  motionSpring,
  radius,
  shadow,
  sol,
  space,
} from '@/theme';
import * as audio from '@/services/audio';
import { useMovimientoReducido } from '@/utils';

interface Props {
  visible: boolean;
  correct: boolean;
  answer: string;
  nota?: string | null;
  nextLabel?: string;
  /** Un salto ya está en curso en la sesión: comparte el candado con "Saltar". */
  avanzando?: boolean;
  onContinue: () => void;
  onDetail?: () => void;
}

/**
 * La banda de resultado que sube desde abajo.
 *
 * Decisión de diseño del mockup: el fallo es ámbar, nunca rojo, y el
 * texto nunca dice "incorrecto". El usuario va a fallar cientos de veces
 * por diseño; si cada una se siente como un regaño, abandona en la
 * semana dos.
 */
export function FeedbackBand({
  visible,
  correct,
  answer,
  nota,
  nextLabel,
  avanzando = false,
  onContinue,
  onDetail,
}: Props) {
  const [esperando, setEsperando] = useState(false);
  const reducido = useMovimientoReducido();
  const y = useSharedValue(240);
  const fade = useSharedValue(0);
  const verdictScale = useSharedValue(0.9);

  useEffect(() => {
    if (visible) {
      // Ligero overshoot: se siente a resultado que llega, no a menú.
      y.value = reducido ? 0 : withSpring(0, motionSpring.conRebote);
      fade.value = withTiming(1, {
        duration: reducido ? 0 : motionDuration.rapida,
        easing: motionEasing.salida,
      });
      // Solo "Exacto" hace el pop: el fallo no necesita más énfasis del
      // que ya tiene, es ámbar y ya, nunca un signo de exclamación extra.
      if (correct && !reducido) {
        verdictScale.value = 0.9;
        verdictScale.value = withSpring(1, motionSpring.conRebote);
      } else {
        verdictScale.value = 1;
      }
    } else {
      y.value = withTiming(240, {
        duration: reducido ? 0 : motionDuration.rapida,
        easing: motionEasing.entrada,
      });
      fade.value = withTiming(0, {
        duration: reducido ? 0 : motionDuration.rapida,
        easing: motionEasing.entrada,
      });
    }
  }, [visible, correct, reducido, y, fade, verdictScale]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: fade.value,
  }));

  const verdictAnim = useAnimatedStyle(() => ({
    transform: [{ scale: verdictScale.value }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Desenfoque + velo opaco: lo de atras deja de leerse del todo.
          Con velo translucido se alcanzaban las opciones y el ojo se iba
          para alla justo en el medio segundo que es el aprendizaje. */}
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.velo]} />

      <Animated.View style={[styles.filo, anim]}>
        <LinearGradient
          colors={correct ? filoOk : filoWrong}
          start={sol.start}
          end={sol.end}
          style={styles.filoCapa}
        >
        <View
          style={[styles.wrap, correct ? styles.ok : styles.miss]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${correct ? 'Exacto' : 'Era esta'}. ${answer}`}
        >
      <View style={styles.head}>
        <Animated.Text
          style={[styles.verdict, correct ? styles.okText : styles.missText, verdictAnim]}
        >
          {correct ? 'Exacto' : 'Era esta'}
        </Animated.Text>
        {nextLabel ? <Text style={styles.next}>{nextLabel}</Text> : null}
      </View>

      <Text style={styles.answer}>{answer}</Text>

      {nota ? <Text style={styles.nota}>{nota}</Text> : null}

      <View style={styles.actions}>
        {onDetail ? (
          <Button
            label="Ver detalle"
            onPress={onDetail}
            variant="ghost"
            style={styles.detail}
          />
        ) : null}
        {/* Flecha, no texto. Es el botón que más se toca en toda la app
            y a la tercera tarjeta ya nadie lo lee: solo apunta el dedo. */}
        {/* Espera a que termine el audio antes de pasar. Sin esto,
            tocar tres veces seguido deja tres audios encimados y el
            usuario oye el primero mientras ve la cuarta frase. */}
        <Button
          label={esperando ? '…' : '→'}
          accessibilityLabel="Siguiente"
          disabled={esperando || avanzando}
          onPress={async () => {
            if (esperando || avanzando) return;
            setEsperando(true);
            await audio.waitUntilDone();
            setEsperando(false);
            onContinue();
          }}
          variant={correct ? 'primary' : 'secondary'}
          style={styles.continue}
        />
      </View>
        </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * La respuesta se muestra al centro, no pegada abajo.
   *
   * Pegada abajo tapaba las opciones y el botón de salir, y en pantallas
   * chicas se comía media tarjeta. Al centro flota sobre un velo oscuro:
   * el ojo va directo al veredicto y nada de lo de atrás queda a medias.
   */
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  velo: { backgroundColor: color.velo },
  /** Envoltura de 1px con el filo de luz. Sustituye al borde de 2px. */
  filo: { borderRadius: radius.xl, ...shadow.raised },
  filoCapa: { borderRadius: radius.xl, padding: 1 },
  wrap: {
    padding: space.lg,
    borderRadius: radius.xl - 1,
    gap: space.sm,
    overflow: 'hidden',
  },
  ok: { backgroundColor: color.correctFondo },
  miss: { backgroundColor: color.wrongFondo },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verdict: {
    fontSize: font.size.sm,
    fontFamily: font.family.bodyStrong,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  okText: { color: color.correct },
  missText: { color: color.wrong },
  next: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted },
  answer: {
    fontSize: font.size.xl,
    fontFamily: font.family.heading,
    color: color.text,
    lineHeight: font.size.xl * 1.3,
  },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.5,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  detail: { flex: 1 },
  continue: { flex: 2 },
});
