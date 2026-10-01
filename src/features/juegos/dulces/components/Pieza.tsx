import React, { memo, useEffect, useRef, useState, useEffectEvent } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ANIMACION_DULCES, DEPURACION_DULCES } from '@/config/dulces';
import { registrarFalla } from '@/services/fallas';
import { Presionable } from '@/shared/ui/Presionable';
import { color, motionDuration, motionDulces, motionEasing, motionSpring, radius } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { CaraPieza } from './SimboloPieza';
import { etiquetaPieza } from '@/features/juegos/dulces/logic/piezas';
import { REBOTE_DP, duracionCaida } from '@/features/juegos/dulces/logic/tablero';
import type { Ida } from '@/features/juegos/dulces/logic/vistaTablero';

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
/** Cuánto «va» hacia su vecina una pieza rechazada (fracción de una celda) antes de regresar. */
const IDA_RECHAZO = 0.35;
/** Cuánto puede alejarse (dp) una pieza de su celda en reposo antes de contarlo como desfase (solo depuración). */
const TOLERANCIA_DP = 0.75;
const DEPURANDO = __DEV__ || DEPURACION_DULCES;

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
  /** El id que le dio el dominio: es la key y sirve para los registros de depuración. */
  id: number;
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
  /** Hacia dónde «va» al ser rechazada (la vecina con la que se quiso intercambiar); sin vecina, solo se sacude. */
  ida?: Ida;
  /**
   * Cambia cuando el tablero queda quieto (terminó el reparto o una jugada): la pieza se planta en su celda,
   * entera y visible, sin animación. Si una actualización de la animación se perdió (una pieza nueva que se
   * quedó arriba, fuera del recorte, o una que no bajó), aquí se corrige y no queda un hueco en el tablero.
   */
  asiento: number;
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
  id,
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
  ida,
  asiento,
  onTocar,
}: Props) {
  const reducido = useMovimientoReducido();
  const x = col * paso;
  const y = fila * paso;
  const px = useSharedValue(x);
  const py = useSharedValue(entrada && ANIMACION_DULCES ? entrada.desde * paso : y);
  const escala = useSharedValue(1);
  const realce = useSharedValue(1);
  const opacidad = useSharedValue(entrada && reducido ? 0 : 1);
  const giro = useSharedValue(0);
  const [sacude, setSacude] = useState(false);

  /** Cae hasta `destino` acelerando y rebota un poco al aterrizar; un paso de fila y media cae en 160 ms. */
  const caer = (destino: number, filas: number, retraso: number) => {
    py.set(withDelay(
      retraso,
      withSequence(
        withTiming(destino, { duration: duracionCaida(filas), easing: motionEasing.salir }),
        withTiming(destino - REBOTE_DP, { duration: motionDulces.reboteMs / 2, easing: motionEasing.entrar }),
        withTiming(destino, { duration: motionDulces.reboteMs / 2, easing: motionEasing.salir })
      )
    ));
  };

  // Al montar: la que entra por arriba cae a su celda con el escalón de su columna.
  const alMontar = useEffectEvent(() => {
    if (!entrada) return;
    if (reducido || !ANIMACION_DULCES) {
      py.set(y);
      opacidad.set(withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }));
      return;
    }
    if (entrada.desde >= fila) {
      // Sin nada que caer (una pieza nueva del rebarajado): solo aparece.
      opacidad.set(0);
      opacidad.set(withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
      return;
    }
    caer(y, fila - entrada.desde, entrada.retraso);
    // Solo cuenta la entrada del montaje.
  });
  useEffect(() => alMontar(), []);

  // Cada vez que cambia de celda: el intercambio, la caída o el rebarajado.
  const efectoMov = useEffectEvent(() => {
    if (!mov) return;
    if (reducido || !ANIMACION_DULCES) {
      px.set(x);
      py.set(y);
      opacidad.set(withSequence(
        withTiming(0.35, { duration: motionDuration.rapido / 2, easing: motionEasing.salir }),
        withTiming(1, { duration: motionDuration.rapido / 2, easing: motionEasing.entrar })
      ));
      return;
    }
    if (mov.tipo === 'caida') {
      px.set(x);
      caer(y, mov.filas, 0);
      return;
    }
    const duracion = mov.tipo === 'rebaraja' ? motionDuration.lento : motionDuration.base;
    const cfg = { duration: duracion, easing: motionEasing.entrar };
    px.set(withTiming(x, cfg));
    py.set(withTiming(y, cfg));
    if (mov.tipo === 'rebaraja') {
      giro.set(0);
      giro.set(withTiming(360, cfg));
    } else if (mov.asienta) {
      // El intercambio no armó nada: se queda, y las piezas se asientan con un rebote corto al llegar.
      escala.set(withDelay(
        duracion,
        withSequence(
          withTiming(ASIENTO, { duration: motionDuration.rapido / 2, easing: motionEasing.salir }),
          withSpring(1, motionSpring.rebote)
        )
      ));
    }
    // El movimiento es lo que cambia de celda, no `x` ni `y` sueltas.
  });
  useEffect(() => efectoMov(), [mov]);

  // Forma línea: pulsa y se va.
  useEffect(() => {
    if (!explota) return;
    if (reducido) {
      opacidad.set(withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }));
      return;
    }
    escala.set(withSequence(
      withTiming(PULSO, { duration: motionDulces.pulso, easing: motionEasing.entrar }),
      withTiming(ENCOGIDA, { duration: motionDulces.estallido, easing: motionEasing.salir })
    ));
    opacidad.set(withDelay(motionDulces.pulso, withTiming(0, { duration: motionDulces.estallido, easing: motionEasing.salir })));
  }, [explota, reducido, escala, opacidad]);

  // El tablero quedó quieto: la pieza se planta donde debe estar. `modify()` fuerza la actualización aunque el
  // valor ya sea el mismo (si no, Reanimated la omite y la vista seguiría con lo que se perdió). Al montar no:
  // una pieza nueva de la cascada tiene que caer, no aparecer ya plantada.
  const asientoMontaje = useRef(asiento);
  // Solo depuración: antes de plantarla, ¿la pieza estaba donde debía? Si no, la animación la dejó fuera de su celda.
  const avisarDesfase = useEffectEvent(() => {
    try {
      const dx = px.get() - x;
      const dy = py.get() - y;
      if (Math.abs(dx) <= TOLERANCIA_DP && Math.abs(dy) <= TOLERANCIA_DP) return;
      const aviso = `[dulces] la pieza ${id} (celda ${fila},${col}) estaba fuera de su lugar: dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`;
      console.error(aviso);
      void registrarFalla(new Error(aviso), "dulces:desfase");
    } catch {
      // Leer un valor compartido desde JS puede fallar fuera de depuración: aquí no importa.
    }
  });
  const plantar = useEffectEvent(() => {
    if (explota) return;
    if (DEPURANDO) avisarDesfase();
    px.set(x);
    px.modify();
    py.set(y);
    py.modify();
    opacidad.set(1);
    opacidad.modify();
    escala.set(1);
    escala.modify();
    giro.set(0);
    giro.modify();
  });
  useEffect(() => {
    if (asiento === asientoMontaje.current) return;
    plantar();
  }, [asiento]);

  // La pieza elegida se levanta un poco.
  useEffect(() => {
    const meta = elegida && !reducido ? REALCE : 1;
    realce.set(withTiming(meta, { duration: motionDuration.rapido, easing: motionEasing.entrar }));
  }, [elegida, reducido, realce]);

  // El deslizamiento no tenía a dónde ir: cabecea y se sacude (la sacudida estándar), sin color de error.
  useEffect(() => {
    if (!rechazo) return undefined;
    setSacude(true);
    if (!reducido) {
      escala.set(withSequence(
        withTiming(REBOTE_RECHAZO, { duration: motionDuration.rapido / 2, easing: motionEasing.salir }),
        withSpring(1, motionSpring.rebote)
      ));
    }
    const t = setTimeout(() => setSacude(false), motionDuration.base);
    return () => clearTimeout(t);
  }, [rechazo, reducido, escala]);

  // Un intercambio rechazado: la pieza «va» hacia su vecina y regresa (la sacudida de arriba la acompaña).
  const efectoIda = useEffectEvent(() => {
    if (!rechazo || reducido || !ida || (ida.dx === 0 && ida.dy === 0)) return;
    const d = paso * IDA_RECHAZO;
    const cfg = (easing: typeof motionEasing.salir) => ({ duration: motionDuration.rapido, easing });
    px.set(withSequence(withTiming(x + ida.dx * d, cfg(motionEasing.salir)), withTiming(x, cfg(motionEasing.entrar))));
    py.set(withSequence(withTiming(y + ida.dy * d, cfg(motionEasing.salir)), withTiming(y, cfg(motionEasing.entrar))));
  });
  useEffect(() => efectoIda(), [rechazo]);

  const lugar = useAnimatedStyle(() => ({
    opacity: opacidad.get(),
    transform: [
      { translateX: px.get() },
      { translateY: py.get() },
      { rotate: `${giro.get()}deg` },
      { scale: escala.get() * realce.get() },
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
