import React, { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { color, font, motionDuration, motionEasing, motionSpring, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { DulceObjetivo } from '@/types';
import { CaraPieza, tinteDe } from './SimboloPieza';
import { NOMBRE_FORMA, formaDe, indiceMasCercana, nombreColor } from './piezas';

/** El lado de la pieza pequeña que marca a qué color pertenece la meta. */
const LADO_SIMBOLO = 28;
const ALTO_BARRA = 8;

interface BarraProps {
  llevas: number;
  meta: number;
  tinte: string;
}

/** La barra de la meta: se llena con resorte cuando llegan los trozos; con «reducir movimiento» salta al valor. */
function BarraMeta({ llevas, meta, tinte }: BarraProps) {
  const reducido = useMovimientoReducido();
  const pct = meta > 0 ? Math.min(1, llevas / meta) : 0;
  const progreso = useSharedValue(pct);

  useEffect(() => {
    progreso.value = reducido ? pct : withSpring(pct, motionSpring.liquido);
  }, [pct, reducido, progreso]);

  // Solo transform: animar `width` fuerza layout nativo en cada cuadro.
  const relleno = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.min(1, Math.max(0, progreso.value)) }] }));

  return (
    <View style={styles.pista}>
      <Animated.View style={[styles.relleno, { backgroundColor: tinte }, relleno]} />
    </View>
  );
}

interface Props {
  objetivo: DulceObjetivo;
  /** Es la que está más cerca de llenarse: lleva un filo de luz de su color. */
  cercana: boolean;
}

/**
 * Una meta: la pieza pequeña de su color (con su forma), la frase en inglés y su barra de 8 px del color de
 * la pieza con «7 de 10». Para el lector de pantalla es una sola cosa: la frase, el color y la forma, y el
 * avance como barra de progreso.
 */
export const MetaFrase = memo(function MetaFrase({ objetivo, cercana }: Props) {
  const reducido = useMovimientoReducido();
  const filo = useSharedValue(cercana ? 1 : 0);
  const tinte = tinteDe(objetivo.color);
  const llevas = Math.min(objetivo.llevas, objetivo.meta);

  useEffect(() => {
    const meta = cercana ? 1 : 0;
    filo.value = reducido ? meta : withTiming(meta, { duration: motionDuration.lento, easing: motionEasing.entrar });
  }, [cercana, reducido, filo]);

  const luz = useAnimatedStyle(() => ({ opacity: filo.value }));

  return (
    <View
      style={styles.fila}
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
        <Text style={styles.frase} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {objetivo.entry.phrase}
        </Text>
        <View style={styles.progreso}>
          <BarraMeta llevas={llevas} meta={objetivo.meta} tinte={tinte.medio} />
          <Text style={styles.cuenta} maxFontSizeMultiplier={1.2}>
            {llevas} de {objetivo.meta}
          </Text>
        </View>
      </View>
    </View>
  );
});

interface TarjetaProps {
  objetivos: DulceObjetivo[];
}

/** Las metas del nivel en una sola tarjeta. */
export function TarjetaMetas({ objetivos }: TarjetaProps) {
  const cercana = indiceMasCercana(objetivos);
  return (
    <View style={styles.tarjeta}>
      {objetivos.map((o, i) => (
        <MetaFrase key={o.color} objetivo={o} cercana={i === cercana} />
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
