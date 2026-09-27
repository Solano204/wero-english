import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Presionable } from '@/components/base/Presionable';
import { color, motionDuration, motionDulces, motionEasing, motionSpring, radius } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { CaraPieza } from './SimboloPieza';
import { etiquetaPieza } from './piezas';
import { REBOTE_DP, duracionCaida } from './tablero';

/** El área táctil mínima: una pieza más chica que esto se amplía con `hitSlop` hasta llegar. */
const AREA_MINIMA = 48;
/** Cuánto crece la pieza elegida y cuánto cabecea cuando el intercambio no se puede hacer. */
const REALCE = 1.08;
const REBOTE_RECHAZO = 0.92;
/** Cuánto crece al pulsar antes de irse, y a cuánto se encoge al irse. */
const PULSO = 1.14;
const ENCOGIDA = 0.2;
/** Cuánto se hunde al asentarse un intercambio que no armó nada. */
const ASIENTO = 0.94;

/** Por qué una pieza cambió de celda: decide cómo se mueve hasta ella. */
export interface Movimiento {
  tipo: 'intercambio' | 'caida' | 'rebaraja';
  /** Cuántas filas baja (solo en `caida`). */
  filas: number;
  /** Un intercambio que no armó nada: las piezas se asientan con un rebote corto al llegar. */
  asienta: boolean;
  /** Cambia en cada movimiento: es lo que dispara la animación. */
  nonce: number;
}

/** Una pieza que entra por arriba del tablero: desde qué fila (negativa) y con qué retraso. */
export interface Entrada {
  desde: number;
  retraso: number;
}

interface Props {
  color: number;
  /** La celda actual de la pieza (fila * columnas + columna). */
  celda: number;
  fila: number;
  col: number;
  /** Lo que hay de una celda a la siguiente (pieza más hueco). */
  paso: number;
  lado: number;
  elegida: boolean;
  /** Forma línea: pulsa y se va, mientras salen sus trozos. */
  explota: boolean;
  mov: Movimiento | null;
  /** Solo al montar: la pieza entra cayendo desde arriba. */
  entrada?: Entrada;
  /** Cambia cuando el deslizamiento no tenía a dónde ir: la pieza cabecea y se sacude. */
  rechazo: number;
  onTocar: (celda: number) => void;
}

/**
 * Una pieza del tablero: un cubito con su forma que se mueve con valores compartidos (posición, escala,
 * opacidad y giro), sin `setState` por cuadro y con un id estable: la pieza que baja es la misma pieza, no una
 * nueva. Un `Animated.View` exterior lleva la posición y el `Presionable` va adentro, porque `Presionable` anima
 * su propio `transform`; las dos animaciones no comparten vista y Reanimated no avisa.
 *
 * Se mueve según por qué cambió de celda (`mov`): el intercambio la desliza a su lugar (`base`, `entrar`); la
 * caída la acelera y le da un rebote pequeño al aterrizar; el rebarajado la desliza girando (`lento`). Con
 * «reducir movimiento» no se desliza, gira ni rebota: salta a su celda y cambia con un fundido de 150 ms.
 *
 * Lleva su forma además del color y una etiqueta que las dice («Amarillo, círculo, fila 2, columna 3»). Si
 * mide menos de 48 dp (8 columnas en un teléfono angosto) el área táctil se completa con `hitSlop`.
 */
export const Pieza = memo(function Pieza({
  color: c,
  celda,
  fila,
  col,
  paso,
  lado,
  elegida,
  explota,
  mov,
  entrada,
  rechazo,
  onTocar,
}: Props) {
  const reducido = useMovimientoReducido();
  const x = col * paso;
  const y = fila * paso;
  const px = useSharedValue(x);
  const py = useSharedValue(entrada ? entrada.desde * paso : y);
  const escala = useSharedValue(1);
  const realce = useSharedValue(1);
  const opacidad = useSharedValue(entrada && reducido ? 0 : 1);
  const giro = useSharedValue(0);
  const [sacude, setSacude] = useState(false);

  /** Cae hasta `destino` acelerando y rebota un poco al aterrizar; un paso de fila y media cae en 160 ms. */
  const caer = (destino: number, filas: number, retraso: number) => {
    py.value = withDelay(
      retraso,
      withSequence(
        withTiming(destino, { duration: duracionCaida(filas), easing: motionEasing.salir }),
        withTiming(destino - REBOTE_DP, { duration: motionDulces.reboteMs / 2, easing: motionEasing.entrar }),
        withTiming(destino, { duration: motionDulces.reboteMs / 2, easing: motionEasing.salir })
      )
    );
  };

  // Al montar: la que entra por arriba cae a su celda con el escalón de su columna.
  useEffect(() => {
    if (!entrada) return;
    if (reducido) {
      py.value = y;
      opacidad.value = withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar });
      return;
    }
    if (entrada.desde >= fila) {
      // Sin nada que caer (una pieza nueva del rebarajado): solo aparece.
      opacidad.value = 0;
      opacidad.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
      return;
    }
    caer(y, fila - entrada.desde, entrada.retraso);
    // Solo cuenta la entrada del montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada vez que cambia de celda: el intercambio, la caída o el rebarajado.
  useEffect(() => {
    if (!mov) return;
    if (reducido) {
      px.value = x;
      py.value = y;
      opacidad.value = withSequence(
        withTiming(0.35, { duration: motionDuration.rapido / 2, easing: motionEasing.salir }),
        withTiming(1, { duration: motionDuration.rapido / 2, easing: motionEasing.entrar })
      );
      return;
    }
    if (mov.tipo === 'caida') {
      px.value = x;
      caer(y, mov.filas, 0);
      return;
    }
    const duracion = mov.tipo === 'rebaraja' ? motionDuration.lento : motionDuration.base;
    const cfg = { duration: duracion, easing: motionEasing.entrar };
    px.value = withTiming(x, cfg);
    py.value = withTiming(y, cfg);
    if (mov.tipo === 'rebaraja') {
      giro.value = 0;
      giro.value = withTiming(360, cfg);
    } else if (mov.asienta) {
      // El intercambio no armó nada: se queda, y las piezas se asientan con un rebote corto al llegar.
      escala.value = withDelay(
        duracion,
        withSequence(
          withTiming(ASIENTO, { duration: motionDuration.rapido / 2, easing: motionEasing.salir }),
          withSpring(1, motionSpring.rebote)
        )
      );
    }
    // El movimiento es lo que cambia de celda, no `x` ni `y` sueltas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mov]);

  // Forma línea: pulsa y se va.
  useEffect(() => {
    if (!explota) return;
    if (reducido) {
      opacidad.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });
      return;
    }
    escala.value = withSequence(
      withTiming(PULSO, { duration: motionDulces.pulso, easing: motionEasing.entrar }),
      withTiming(ENCOGIDA, { duration: motionDulces.estallido, easing: motionEasing.salir })
    );
    opacidad.value = withDelay(motionDulces.pulso, withTiming(0, { duration: motionDulces.estallido, easing: motionEasing.salir }));
  }, [explota, reducido, escala, opacidad]);

  // La pieza elegida se levanta un poco.
  useEffect(() => {
    const meta = elegida && !reducido ? REALCE : 1;
    realce.value = withTiming(meta, { duration: motionDuration.rapido, easing: motionEasing.entrar });
  }, [elegida, reducido, realce]);

  // El deslizamiento no tenía a dónde ir: cabecea y se sacude (la sacudida estándar), sin color de error.
  useEffect(() => {
    if (!rechazo) return undefined;
    setSacude(true);
    if (!reducido) {
      escala.value = withSequence(
        withTiming(REBOTE_RECHAZO, { duration: motionDuration.rapido / 2, easing: motionEasing.salir }),
        withSpring(1, motionSpring.rebote)
      );
    }
    const t = setTimeout(() => setSacude(false), motionDuration.base);
    return () => clearTimeout(t);
  }, [rechazo, reducido, escala]);

  const lugar = useAnimatedStyle(() => ({
    opacity: opacidad.value,
    transform: [
      { translateX: px.value },
      { translateY: py.value },
      { rotate: `${giro.value}deg` },
      { scale: escala.value * realce.value },
    ],
  }));

  const holgura = Math.max(0, Math.ceil((AREA_MINIMA - lado) / 2));
  return (
    <Animated.View pointerEvents={explota ? 'none' : 'auto'} style={[styles.lugar, { width: lado, height: lado, zIndex: elegida ? 2 : 0 }, lugar]}>
      <Presionable
        onPress={() => onTocar(celda)}
        accessibilityRole="button"
        accessibilityLabel={etiquetaPieza(c, fila, col)}
        accessibilityState={{ selected: elegida }}
        hitSlop={holgura}
        resultado={sacude ? 'fallo' : null}
        style={styles.pieza}
      >
        <CaraPieza color={c} lado={lado} />
        {elegida ? <View pointerEvents="none" style={styles.anillo} /> : null}
      </Presionable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  lugar: { position: 'absolute', left: 0, top: 0 },
  pieza: { flex: 1, borderRadius: radius.sm },
  // El anillo de la pieza elegida va encima y no toca el tamaño de la pieza.
  anillo: { ...StyleSheet.absoluteFill, borderRadius: radius.sm, borderWidth: 3, borderColor: color.text },
});
