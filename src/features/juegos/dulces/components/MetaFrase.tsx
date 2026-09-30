import React, { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { color, escalon, font, motionDuration, motionEasing, motionSpring, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { DulceObjetivo } from '@/types';
import { CaraPieza, tinteDe } from './SimboloPieza';
import { NOMBRE_FORMA, formaDe, indiceMasCercana, nombreColor } from '@/features/juegos/dulces/logic/piezas';

/** El lado de la pieza pequeña que marca a qué color pertenece la meta. */
const LADO_SIMBOLO = 28;
const ALTO_BARRA = 8;
/** Cuánto suben las metas al entrar. */
const ENTRADA_SUBE = 12;

interface BarraProps {
  llevas: number;
  meta: number;
  tinte: string;
  /** Para saber dónde está la barra (a dónde vuelan los trozos). */
  barraRef?: (vista: View | null) => void;
  /** 0 a 1: el destello de la barra al llenarse. */
  brillo: SharedValue<number>;
}

/** La barra de la meta: se llena con resorte cuando llegan los trozos; con «reducir movimiento» salta al valor. */
function BarraMeta({ llevas, meta, tinte, barraRef, brillo }: BarraProps) {
  const reducido = useMovimientoReducido();
  const pct = meta > 0 ? Math.min(1, llevas / meta) : 0;
  const progreso = useSharedValue(pct);

  useEffect(() => {
    progreso.value = reducido ? pct : withSpring(pct, motionSpring.liquido);
  }, [pct, reducido, progreso]);

  // Solo transform: animar `width` fuerza layout nativo en cada cuadro.
  const relleno = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.min(1, Math.max(0, progreso.value)) }] }));
  const destello = useAnimatedStyle(() => ({ opacity: brillo.value * 0.6 }));

  return (
    <View ref={barraRef} collapsable={false} style={styles.pista}>
      <Animated.View style={[styles.relleno, { backgroundColor: tinte }, relleno]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.text }, destello]} />
    </View>
  );
}

interface Props {
  objetivo: DulceObjetivo;
  /** Es la que está más cerca de llenarse: lleva un filo de luz de su color. */
  cercana: boolean;
  /** Avisa de la vista de la barra al montar y al desmontar, para medirla. */
  registrarBarra?: (color: number, vista: View | null) => void;
  /** Lo mismo con la frase: de ahí despega cuando se llena la meta. */
  registrarFrase?: (color: number, vista: View | null) => void;
  /** La barra se llenó y sale la pregunta: destella. */
  llena?: boolean;
  /** Su lugar en la tarjeta: entra escalonada, con `escalon(orden)`. */
  orden?: number;
}

/**
 * Una meta: la pieza pequeña de su color (con su forma), la frase en inglés y su barra de 8 px del color de
 * la pieza con «7 de 10». Para el lector de pantalla es una sola cosa: la frase, el color y la forma, y el
 * avance como barra de progreso.
 */
export const MetaFrase = memo(function MetaFrase({ objetivo, cercana, registrarBarra, registrarFrase, llena = false, orden = 0 }: Props) {
  const reducido = useMovimientoReducido();
  const filo = useSharedValue(cercana ? 1 : 0);
  const tinte = tinteDe(objetivo.color);
  const llevas = Math.min(objetivo.llevas, objetivo.meta);

  useEffect(() => {
    const meta = cercana ? 1 : 0;
    filo.value = reducido ? meta : withTiming(meta, { duration: motionDuration.lento, easing: motionEasing.entrar });
  }, [cercana, reducido, filo]);

  const destello = useSharedValue(0);
  const fundido = useSharedValue(1);
  const entrada = useSharedValue(reducido ? 1 : 0);
  const idFrase = useRef(objetivo.entry.id);
  const colorDeMeta = objetivo.color;
  const alRegistrar = useCallback((vista: View | null) => registrarBarra?.(colorDeMeta, vista), [registrarBarra, colorDeMeta]);
  const alRegistrarFrase = useCallback((vista: View | null) => registrarFrase?.(colorDeMeta, vista), [registrarFrase, colorDeMeta]);

  // Al empezar, las metas entran una tras otra: suben un poco mientras se aclaran.
  useEffect(() => {
    entrada.value = reducido ? 1 : withDelay(escalon(orden), withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar }));
    // Solo cuenta la entrada del montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La barra se llena y sale la pregunta: destella una vez (con «reducir movimiento» queda encendida mientras dura).
  useEffect(() => {
    if (!llena) {
      destello.value = 0;
      return;
    }
    destello.value = reducido
      ? 1
      : withSequence(
          withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
          withTiming(0, { duration: motionDuration.lento, easing: motionEasing.salir })
        );
  }, [llena, reducido, destello]);

  // Al cerrar la pregunta la meta se reinicia con la frase nueva, que entra con un fundido.
  useEffect(() => {
    if (idFrase.current === objetivo.entry.id) return;
    idFrase.current = objetivo.entry.id;
    fundido.value = 0;
    fundido.value = reducido ? 1 : withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar });
  }, [objetivo.entry.id, reducido, fundido]);

  const luz = useAnimatedStyle(() => ({ opacity: Math.max(filo.value, destello.value) }));
  const fraseAnim = useAnimatedStyle(() => ({ opacity: fundido.value }));
  const entra = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: (1 - entrada.value) * ENTRADA_SUBE }],
  }));

  return (
    <Animated.View
      style={[styles.fila, entra]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${objetivo.entry.phrase}. ${nombreColor(objetivo.color)}, ${NOMBRE_FORMA[formaDe(objetivo.color)]}: ${llevas} de ${objetivo.meta}`}
      accessibilityValue={{ min: 0, max: objetivo.meta, now: llevas }}
    >
      <Animated.View pointerEvents="none" style={[styles.filo, { borderColor: tinte.claro }, luz]} />
      <View style={styles.simbolo}>
        <CaraPieza color={objetivo.color} lado={LADO_SIMBOLO} />
      </View>
      <View style={styles.cuerpo}>
        <View ref={alRegistrarFrase} collapsable={false}>
          <Animated.View style={fraseAnim}>
            <Text style={styles.frase} numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {objetivo.entry.phrase}
            </Text>
          </Animated.View>
        </View>
        <View style={styles.progreso}>
          <BarraMeta llevas={llevas} meta={objetivo.meta} tinte={tinte.medio} barraRef={alRegistrar} brillo={destello} />
          <Text style={styles.cuenta} maxFontSizeMultiplier={1.2}>
            {llevas} de {objetivo.meta}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

interface TarjetaProps {
  objetivos: DulceObjetivo[];
  registrarBarra?: (color: number, vista: View | null) => void;
  registrarFrase?: (color: number, vista: View | null) => void;
  /** El color de la meta que se acaba de llenar (mientras su pregunta está abierta), o `null`. */
  llenaColor?: number | null;
}

/** Las metas del nivel en una sola tarjeta. */
export function TarjetaMetas({ objetivos, registrarBarra, registrarFrase, llenaColor = null }: TarjetaProps) {
  const cercana = indiceMasCercana(objetivos);
  return (
    <View style={styles.tarjeta}>
      {objetivos.map((o, i) => (
        <MetaFrase
          key={o.color}
          objetivo={o}
          cercana={i === cercana}
          registrarBarra={registrarBarra}
          registrarFrase={registrarFrase}
          llena={o.color === llenaColor}
          orden={i}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.sm,
    gap: space.xs,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md },
  // El filo de luz de la meta que está por llenarse: un borde de su color, que se enciende y se apaga.
  filo: { ...StyleSheet.absoluteFill, borderRadius: radius.md, borderWidth: 1 },
  simbolo: { width: LADO_SIMBOLO, height: LADO_SIMBOLO },
  cuerpo: { flex: 1, gap: space.xs },
  frase: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  progreso: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pista: { flex: 1, height: ALTO_BARRA, borderRadius: radius.pill, backgroundColor: color.trackFondo, overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: radius.pill, transformOrigin: 'left' },
  cuenta: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.textMuted, fontVariant: ['tabular-nums'] },
});
