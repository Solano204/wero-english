import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Button } from '@/shared/ui/Button';
import { Marcador } from '@/shared/ui/fx/Marcador';
import { color, font, motionDuration, motionEasing, radius, space } from '@/theme';
import { plural } from '@/domain/texto';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { conteo } from '@/domain/texto';

/** En las últimas jugadas la barra late una vez por jugada. */
const ULTIMAS = 5;
/** Cuánto crece la barra al latir. */
const LATE = 1.8;

interface Props {
  /** Las jugadas que quedan. */
  jugadas: number;
  /** Con las que empezó el nivel: la barra se vacía de este total a cero. */
  total: number;
  onDejar: () => void;
}

/**
 * El pie de Dulces, en la zona del pulgar: «N jugadas» con el `Marcador` (rueda al restar), una barra fina que
 * se vacía y «Dejarlo aquí» (`ghost`). En las últimas cinco jugadas la barra pasa a `accent` y late una vez
 * cada vez que se gasta una: es el aviso de que se acaban, no un castigo, así que nunca hay rojo ni ámbar.
 * Con «reducir movimiento» la barra se actualiza directo y no late.
 */
export function PieDulces({ jugadas, total, onDejar }: Props) {
  const reducido = useMovimientoReducido();
  const pct = total > 0 ? Math.min(1, Math.max(0, jugadas / total)) : 0;
  const avance = useSharedValue(pct);
  const pulso = useSharedValue(0);
  const anterior = useRef(jugadas);
  const enUltimas = jugadas <= ULTIMAS;

  useEffect(() => {
    avance.value = reducido ? pct : withTiming(pct, { duration: motionDuration.lento, easing: motionEasing.entrar });
  }, [pct, reducido, avance]);

  // Una vez por jugada gastada, mientras quedan pocas.
  useEffect(() => {
    const gasto = jugadas < anterior.current;
    anterior.current = jugadas;
    if (!gasto || jugadas > ULTIMAS || reducido) return;
    pulso.value = withSequence(
      withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
    );
  }, [jugadas, reducido, pulso]);

  // Solo transform: animar `width` fuerza layout nativo en cada cuadro.
  const relleno = useAnimatedStyle(() => ({
    transform: [{ scaleX: avance.value }, { scaleY: 1 + (LATE - 1) * pulso.value }],
  }));

  return (
    <View style={styles.pie}>
      <View
        style={styles.cuenta}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={conteo(jugadas, 'jugada')}
        accessibilityValue={{ min: 0, max: total, now: jugadas }}
      >
        <View style={styles.numero} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Marcador valor={jugadas} tamano={font.size.xl} color={color.text} />
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.3}>
            {plural(jugadas, 'jugada')}
          </Text>
        </View>
        <View style={styles.pista}>
          <Animated.View style={[styles.relleno, { backgroundColor: enUltimas ? color.accent : color.textMuted }, relleno]} />
        </View>
      </View>
      <Button label="Dejarlo aquí" variant="ghost" onPress={onDejar} full />
    </View>
  );
}

interface NotaProps {
  /** Se muestra mientras no haya habido ninguna línea. */
  visible: boolean;
  texto: string;
}

/** La nota del inicio: se desvanece tras el primer match y ya no vuelve. Sigue ocupando su lugar para que nada se mueva. */
export function NotaInicial({ visible, texto }: NotaProps) {
  const reducido = useMovimientoReducido();
  const opacidad = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    const meta = visible ? 1 : 0;
    opacidad.value = reducido ? meta : withTiming(meta, { duration: motionDuration.lento, easing: motionEasing.salir });
  }, [visible, reducido, opacidad]);

  const estilo = useAnimatedStyle(() => ({ opacity: opacidad.value }));
  return (
    <Animated.Text
      style={[styles.nota, estilo]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no'}
    >
      {texto}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  pie: { paddingHorizontal: space.lg, paddingBottom: space.lg, paddingTop: space.sm, gap: space.sm },
  cuenta: { gap: space.xs },
  numero: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  etiqueta: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  pista: { height: 4, borderRadius: radius.pill, backgroundColor: color.trackFondo, overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: radius.pill, transformOrigin: 'left' },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.md,
  },
});
