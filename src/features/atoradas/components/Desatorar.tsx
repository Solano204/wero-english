import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Card, Icon } from '@/shared/ui';
import { puntosEncendidos } from '@/domain/atoradas';
import { color, font, motionDesatorar, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Entry } from '@/types';
import { MedidorAtasco } from './MedidorAtasco';

/** Cuánto se desplaza la tarjeta al entrar y al irse, en dp. */
const DESPLAZA = 24;
/** La opacidad más alta del destello `correct` sobre la tarjeta. */
const OPACIDAD_DESTELLO = 0.25;

interface Props {
  entry: Entry;
  /** Los fallos que tenía en la última visita: son los puntos que se apagan. */
  fallos: number;
  /** Espera antes de arrancar (ms): con varias, cada una entra después de la anterior. */
  retraso: number;
  /** La tarjeta ya se fue: quien la muestra la retira. */
  onTerminar: () => void;
}

/**
 * Una frase que se desatoró desde la última visita. Aparece arriba de la lista con su medidor; los puntos se apagan uno
 * por uno, un destello `correct` cruza la tarjeta y aparece «Ya no se te atora»; tras un momento la tarjeta sube, se
 * desvanece y su lugar se cierra (su alto baja a 0), así la lista de abajo no salta. Todo pasa una sola vez y solo con
 * `transform`, `opacity` y ese alto final. Con «reducir movimiento» no hay entrada, puntos ni destello: la tarjeta aparece
 * con los puntos ya apagados, la etiqueta entra con un fundido y se retira sola a los `mantenerReducido` ms. El lector de
 * pantalla oye «frase. Ya no se te atora» sin más.
 */
export function Desatorar({ entry, fallos, retraso, onTerminar }: Props) {
  const reducido = useMovimientoReducido();
  const encendidos = puntosEncendidos(fallos);
  const entra = useSharedValue(0);
  const apagado = useSharedValue(0);
  const destello = useSharedValue(0);
  const etiqueta = useSharedValue(0);
  const sale = useSharedValue(0);
  const altoMedido = useSharedValue(0);

  // El aviso final va por una referencia: la pantalla puede cambiar su callback mientras la tarjeta se anima.
  const alTerminar = useRef(onTerminar);
  alTerminar.current = onTerminar;
  const terminar = useCallback(() => alTerminar.current(), []);

  useEffect(() => {
    const t = motionDesatorar;
    if (reducido) {
      entra.value = 1;
      apagado.value = encendidos;
      etiqueta.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
      const reloj = setTimeout(terminar, t.mantenerReducido);
      return () => {
        clearTimeout(reloj);
        cancelAnimation(etiqueta);
      };
    }
    const trasPuntos = retraso + t.entra + encendidos * t.punto;
    entra.value = withDelay(retraso, withTiming(1, { duration: t.entra, easing: motionEasing.entrar }));
    apagado.value = withDelay(
      retraso + t.entra,
      withTiming(encendidos, { duration: Math.max(1, encendidos * t.punto), easing: motionEasing.lineal })
    );
    destello.value = withDelay(
      trasPuntos,
      withSequence(
        withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
        withTiming(0, { duration: t.destello, easing: motionEasing.salir })
      )
    );
    etiqueta.value = withDelay(trasPuntos, withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
    sale.value = withDelay(
      trasPuntos + t.pausa,
      withTiming(1, { duration: t.sale, easing: motionEasing.salir }, (fin) => {
        'worklet';
        if (fin) runOnJS(terminar)();
      })
    );
    return () => {
      [entra, apagado, destello, etiqueta, sale].forEach((v) => cancelAnimation(v));
    };
  }, [reducido, encendidos, retraso, terminar, entra, apagado, destello, etiqueta, sale]);

  // Al irse, el alto baja a 0 para que la lista de abajo suba sin saltar; antes de irse no se toca.
  const estiloAlto = useAnimatedStyle(() =>
    sale.value > 0 && altoMedido.value > 0 ? { height: altoMedido.value * (1 - sale.value) } : {}
  );
  const estiloTarjeta = useAnimatedStyle(() => ({
    opacity: entra.value * (1 - sale.value),
    transform: [{ translateY: reducido ? 0 : (entra.value - 1) * DESPLAZA - sale.value * DESPLAZA }],
  }));
  const estiloDestello = useAnimatedStyle(() => ({ opacity: destello.value * OPACIDAD_DESTELLO }));
  const estiloEtiqueta = useAnimatedStyle(() => ({ opacity: etiqueta.value }));

  return (
    <Animated.View style={[styles.alto, estiloAlto]}>
      <View
        style={styles.medida}
        onLayout={(e) => {
          altoMedido.value = e.nativeEvent.layout.height;
        }}
        accessible
        accessibilityLabel={`${entry.phrase}. Ya no se te atora`}
        accessibilityLiveRegion="polite"
      >
        <Animated.View style={estiloTarjeta} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Card>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.destello, estiloDestello]} />
            <View style={styles.fila}>
              <View style={styles.textos}>
                <Text style={styles.frase}>{entry.phrase}</Text>
                <Text style={styles.traduccion}>{entry.spanish_main}</Text>
              </View>
              <MedidorAtasco fallos={fallos} apagado={apagado} />
            </View>
            <Animated.View style={[styles.aviso, estiloEtiqueta]}>
              <Icon name="check" size="sm" color={color.correct} />
              <Text style={styles.avisoLetra}>Ya no se te atora</Text>
            </Animated.View>
          </Card>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  alto: { overflow: 'hidden' },
  // El espacio de abajo va dentro de lo que se mide: al irse la tarjeta se cierra también el hueco.
  medida: { paddingBottom: space.md },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  textos: { flex: 1, gap: space.xs },
  destello: { backgroundColor: color.correct, opacity: 0 },
  frase: { fontFamily: font.family.heading, fontSize: font.size.lg, lineHeight: font.size.lg * 1.4, color: color.text },
  traduccion: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  avisoLetra: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.correct },
});
