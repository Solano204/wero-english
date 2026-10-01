import React, { useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { StyleSheet, Text, type LayoutChangeEvent } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { Presionable } from '@/shared/ui/Presionable';
import { color, depth, font, motionDuration, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { ALTO_FICHA, MARGEN_ARRIBA } from '@/features/juegos/caida/logic/medidas';

/** De qué tamaño aparece la ficha. */
const ESCALA_INICIO = 0.96;
/** A qué tamaño llega la ficha acertada al disolverse en el marcador. */
const ESCALA_VUELO = 0.3;
/** Cuánto cae la ficha equivocada mientras se desvanece. */
const CAIDA_DESCARTE = 40;

const acotar = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/**
 * Lo que le pasó a esta ficha en la ronda: `acierto` (la que se tocó bien, vuela al marcador),
 * `descartada` (la que sobra tras un acierto), `fallo` (la que se tocó mal) y `correcta` (la que
 * era, señalada tras un fallo).
 */
export type EstadoFicha = 'normal' | 'acierto' | 'correcta' | 'descartada' | 'fallo';

interface Props {
  texto: string;
  onPress: () => void;
  estado: EstadoFicha;
  /** La posición de la fila: la ficha acertada vuela desde donde se detuvo. */
  y: SharedValue<number>;
  /** El centro del marcador en el espacio de la pista; `null` si aún no se midió (entonces solo se disuelve). */
  destino: { x: number; y: number } | null;
  /** La ficha acertada llegó al marcador. */
  onLlego: () => void;
}

/**
 * Una ficha de respuesta. Mide `ALTO_FICHA` exacto (96 dp): la caída cuenta con ello para detenerse
 * sobre el piso, así que un texto largo se encoge (hasta 0.8) en vez de hacerla crecer. Al aparecer
 * arriba de la pista entra con un fundido y un destello de señal en el borde; quien la usa le pone
 * `key` de la ronda para que se repita.
 *
 * Acierto: se detiene en seco, se llena de `correctFondo` con `check` y sale disparada hacia el
 * marcador, donde se disuelve. La otra ficha se desvanece cayendo. Fallo: la equivocada se sacude y se
 * pone ámbar con `close` (nunca rojo, y siempre con ícono además del color) y la que era se enciende en
 * verde con `check`. Con «reducir movimiento» no hay destello, escala, sacudida, vuelo ni caída: solo
 * cambian los colores, y el marcador se entera igual.
 */
export function FichaCaida({ texto, onPress, estado, y, destino, onLlego }: Props) {
  const reducido = useMovimientoReducido();
  const entrada = useSharedValue(0);
  const destello = useSharedValue(reducido ? 0 : 1);
  const llenado = useSharedValue(0);
  const fallado = useSharedValue(0);
  const vuelo = useSharedValue(0);
  const descarte = useSharedValue(0);
  const centro = useSharedValue(0);
  const alLlegar = useRef(onLlego);
  useLayoutEffect(() => {
    alLlegar.current = onLlego;
  }, [onLlego]);
  const llegar = useCallback(() => alLlegar.current(), []);

  useEffect(() => {
    entrada.set(withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }));
    destello.set(reducido ? 0 : withTiming(0, { duration: motionDuration.lento, easing: motionEasing.salir }));
  }, [reducido, entrada, destello]);

  useEffect(() => {
    if (estado === 'fallo') {
      fallado.set(withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }));
    } else if (estado === 'acierto' || estado === 'correcta') {
      llenado.set(withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }));
      if (estado === 'correcta') return undefined;
      if (reducido) {
        const t = setTimeout(llegar, motionDuration.base);
        return () => clearTimeout(t);
      }
      vuelo.set(withDelay(
        motionDuration.rapido,
        withTiming(1, { duration: motionDuration.lento, easing: motionEasing.salir }, (terminada) => {
          'worklet';
          if (terminada) runOnJS(llegar)();
        })
      ));
    } else if (estado === 'descartada') {
      descarte.set(withTiming(1, { duration: reducido ? motionDuration.rapido : motionDuration.lento, easing: motionEasing.salir }));
    }
    return undefined;
  }, [estado, reducido, llenado, fallado, vuelo, descarte, llegar]);

  const alMedir = (e: LayoutChangeEvent) => {
    centro.set(e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2);
  };

  const lugar = useAnimatedStyle(() => {
    const v = vuelo.get();
    const d = descarte.get();
    const dx = destino ? (destino.x - centro.get()) * v : 0;
    const dy = destino ? (destino.y - (MARGEN_ARRIBA + y.get() + ALTO_FICHA / 2)) * v : 0;
    return {
      opacity: entrada.get() * (1 - acotar((v - 0.6) / 0.4)) * (1 - d),
      transform: [
        { translateX: dx },
        { translateY: dy + CAIDA_DESCARTE * d * (reducido ? 0 : 1) },
        { scale: (reducido ? 1 : ESCALA_INICIO + (1 - ESCALA_INICIO) * entrada.get()) * (1 - (1 - ESCALA_VUELO) * v) },
      ],
    };
  });
  const luz = useAnimatedStyle(() => ({ opacity: destello.get() }));
  const lleno = useAnimatedStyle(() => ({ opacity: llenado.get() }));
  const roto = useAnimatedStyle(() => ({ opacity: fallado.get() }));

  return (
    <Animated.View style={[styles.lugar, lugar]} onLayout={alMedir}>
      <Presionable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={texto}
        accessibilityState={{ selected: estado === 'acierto' || estado === 'correcta' }}
        resultado={estado === 'fallo' ? 'fallo' : null}
        style={[styles.ficha, estado === 'fallo' && styles.fallo]}
      >
        <Animated.View pointerEvents="none" style={[styles.lleno, lleno]} />
        <Text style={styles.texto} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}>
          {texto}
        </Text>
        <Animated.View pointerEvents="none" style={[styles.marca, lleno]}>
          <Icon name="check" size="md" color={color.correct} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.marca, roto]}>
          <Icon name="close" size="md" color={color.wrong} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.destello, luz]} />
      </Presionable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lugar: { flex: 1 },
  ficha: {
    height: ALTO_FICHA,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderBottomWidth: depth.sm,
    borderBottomColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
    // Sin sombra: la ficha cae cuadro a cuadro y en Android una `elevation` en movimiento se vuelve a pintar en cada
    // uno; sobre la pista casi negra no se veía. El canto de abajo (`depth`) es lo que la hace ver como pieza.
  },
  fallo: { backgroundColor: color.wrongFondo, borderColor: color.wrong },
  texto: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    textAlign: 'center',
  },
  // Al acertar la ficha se llena de `correctFondo` (debajo del texto) y trae su `check` en la esquina.
  lleno: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.correct,
    backgroundColor: color.correctFondo,
  },
  marca: { position: 'absolute', top: space.sm, right: space.sm },
  // El destello de señal al aparecer: un borde `accent` que se apaga.
  destello: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.accent,
  },
});
