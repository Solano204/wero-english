import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import * as audio from '@/services/audio';
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
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { ACIERTO, elegirFrase } from '@/domain/frases';

/** El velo nunca pasa de esto: lo de atrás sigue leyéndose. */
const VELO_MAX = 0.5;
/** Lo que hay que deslizar hacia arriba (dp), o la velocidad (dp/s), para que cuente como «Siguiente». */
const UMBRAL_DESLIZAR = 48;
const VELOCIDAD_DESLIZAR = 800;
/** Cuánto sigue el dedo la hoja al deslizar: hacia arriba un poco, hacia abajo casi nada (no se cierra). */
const SEGUIR_ARRIBA = 0.4;
const SEGUIR_ABAJO = 0.25;
const TOPE_ABAJO = 60;

interface Props {
  visible: boolean;
  correct: boolean;
  /** La frase o palabra correcta. */
  answer: string;
  nota?: string | null;
  /** Cuándo vuelve la tarjeta: «Vuelve en esta sesión», «La vuelves a ver mañana»… */
  repaso?: string;
  /** Reemplaza la frase (p. ej. la frase con lo que faltó y lo que sobró marcado en un dictado). */
  frase?: ReactNode;
  /** Un salto ya está en curso en la sesión: comparte el candado con "Saltar". */
  avanzando?: boolean;
  onContinue: () => void;
  onDetail?: () => void;
}

interface Contenido {
  correct: boolean;
  answer: string;
  nota?: string | null;
  repaso?: string;
  frase?: ReactNode;
}

/**
 * El veredicto de una tarjeta: una hoja que sube desde abajo con el resorte de
 * `rebote`, DESPUÉS de que el veredicto ya se vio en su sitio (la opción, las
 * fichas, el hueco). «ESO ES» si le atinaste, «ERA ESTA» si no, con la frase
 * correcta; el fallo es ámbar, nunca rojo, y nunca dice «incorrecto». Un solo
 * botón sólido, «Siguiente», igual en los dos casos; deslizar hacia arriba lo
 * activa, deslizar hacia abajo no la cierra.
 *
 * Con movimiento reducido no sube: aparece con un fundido.
 */
export function HojaVeredicto({
  visible,
  correct,
  answer,
  nota,
  repaso,
  frase,
  avanzando = false,
  onContinue,
  onDetail,
}: Props) {
  const reducido = useMovimientoReducido();
  const { height: alturaVentana } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const [esperando, setEsperando] = useState(false);

  // Al irse, la hoja se lleva su contenido: no se vacía a media salida.
  const ultimo = useRef<Contenido | null>(null);
  if (visible) ultimo.current = { correct, answer, nota, repaso, frase };
  const c = ultimo.current;

  // Una felicitación distinta cada vez (frases.ts): la oye el lector de pantalla; en pantalla manda «ESO ES».
  // visible y answer no se leen, pero son el disparador: una frase nueva cada vez que la hoja sube con otra respuesta.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const felicitacion = useMemo(() => (correct ? elegirFrase(ACIERTO) : 'Era esta'), [visible, correct, answer]);

  const y = useSharedValue(alturaVentana);
  const arrastre = useSharedValue(0);
  const velo = useSharedValue(0);
  const opacidad = useSharedValue(reducido ? 0 : 1);

  useEffect(() => {
    if (visible) {
      // Espera a que el veredicto se vea en su sitio antes de subir.
      const espera = motionDuration.lento;
      velo.value = withDelay(espera, withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
      if (reducido) {
        y.value = 0;
        opacidad.value = withDelay(espera, withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
      } else {
        opacidad.value = 1;
        y.value = withDelay(espera, withSpring(0, motionSpring.rebote));
      }
    } else {
      velo.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });
      if (reducido) opacidad.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });
      else y.value = withTiming(alturaVentana, { duration: motionDuration.rapido, easing: motionEasing.salir });
    }
  }, [visible, reducido, alturaVentana, y, velo, opacidad]);

  const hojaAnim = useAnimatedStyle(() => ({
    opacity: opacidad.value,
    transform: [{ translateY: y.value + arrastre.value }],
  }));
  const veloAnim = useAnimatedStyle(() => ({ opacity: velo.value * VELO_MAX }));

  const continuar = async () => {
    if (esperando || avanzando) return;
    setEsperando(true);
    // Espera a que termine el audio antes de pasar: tocar tres veces seguido
    // dejaba tres audios encimados y se oía el primero viendo la cuarta frase.
    await audio.waitUntilDone();
    setEsperando(false);
    onContinue();
  };

  const gesto = Gesture.Pan()
    .enabled(visible)
    .activeOffsetY([-12, 12])
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      arrastre.value =
        e.translationY < 0
          ? e.translationY * SEGUIR_ARRIBA
          : Math.min(e.translationY, TOPE_ABAJO) * SEGUIR_ABAJO;
    })
    .onEnd((e) => {
      const sube = e.translationY < -UMBRAL_DESLIZAR || e.velocityY < -VELOCIDAD_DESLIZAR;
      arrastre.value = withSpring(0, motionSpring.rebote);
      if (sube) runOnJS(continuar)();
    });

  if (!c) return null;

  const ok = c.correct;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'auto' : 'none'}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!visible}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.velo, veloAnim]} />

      <Animated.View style={[styles.hoja, hojaAnim]}>
        <GestureDetector gesture={gesto}>
          <Animated.View>
            <LinearGradient colors={ok ? filoOk : filoWrong} start={sol.start} end={sol.end} style={styles.filo}>
              <View
                style={[styles.contenido, ok ? styles.ok : styles.mal, { paddingBottom: bottom + space.lg }]}
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${felicitacion}. ${c.answer}${c.nota ? `. ${c.nota}` : ''}`}
              >
                <View style={styles.cabeza}>
                  <View style={styles.titulo}>
                    <Icon name={ok ? 'check' : 'close'} size="md" color={ok ? color.onHojaAcierto : color.wrong} />
                    <Text style={[styles.veredicto, ok ? styles.textoOk : styles.textoMal]}>
                      {ok ? 'Eso es' : 'Era esta'}
                    </Text>
                  </View>
                  {c.repaso ? <Text style={styles.repaso}>{c.repaso}</Text> : null}
                </View>

                {c.frase ?? <Text style={styles.frase}>{c.answer}</Text>}

                {c.nota ? <Text style={styles.nota}>{c.nota}</Text> : null}

                <View style={styles.acciones}>
                  {onDetail ? (
                    <Button label="Ver detalle" variant="ghost" onPress={onDetail} style={styles.detalle} />
                  ) : null}
                  <Button
                    label="Siguiente"
                    icon="arrow-right"
                    iconAlFinal
                    size="lg"
                    loading={esperando}
                    disabled={esperando || avanzando}
                    onPress={continuar}
                    style={styles.siguiente}
                  />
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  velo: { backgroundColor: color.velo },
  hoja: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // El filo de luz de 1 px, solo arriba: la hoja se apoya en el borde de la pantalla.
  filo: {
    padding: 1,
    paddingBottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  contenido: {
    padding: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
    borderTopLeftRadius: radius.xl - 1,
    borderTopRightRadius: radius.xl - 1,
    overflow: 'hidden',
  },
  ok: { backgroundColor: color.hojaAcierto },
  mal: { backgroundColor: color.wrongFondo },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  veredicto: {
    fontSize: font.size.sm,
    fontFamily: font.family.bodyStrong,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  textoOk: { color: color.onHojaAcierto },
  textoMal: { color: color.wrong },
  repaso: { flexShrink: 1, fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted, textAlign: 'right' },
  frase: {
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
  acciones: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  detalle: { flex: 1 },
  siguiente: { flex: 2 },
});
