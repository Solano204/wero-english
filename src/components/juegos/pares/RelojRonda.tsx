import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { useCuentaRegresiva } from '@/shared/ui/RoundTimer';
import { useReloj, useSenalActiva } from '@/shared/ui/fx/useSenalActiva';
import { color, motionSenal, radius, space } from '@/theme';

/** El último tramo del reloj: desde aquí late suave en `accent`. */
const ULTIMO_TRAMO = 0.8;
/** El latido va de esta opacidad a 1 y vuelve. */
const OPACIDAD_MINIMA = 0.65;
const APAGADO = color.textMuted;
const ACENTO = color.accent;

interface Props {
  /** Cuánto dura el tablero (sin cambios: viene del nivel). */
  segundos: number;
  llave: string | number;
  onFin: () => void;
  /** Congela la cuenta: mientras se oye la voz de un par, antes de que caiga la última ficha y al resolver el tablero. */
  pausado?: boolean;
  /** Lo que dice el lector de pantalla; en Colmena es el reloj de la ronda, no el del tablero. */
  etiqueta?: string;
}

/**
 * El reloj de la ronda, claramente un reloj: el ícono `clock` y una barra fina que se
 * vacía, en `textMuted`. En el último 20 % la barra pasa a `accent` y late suave (sin
 * ámbar ni rojo: todavía no ha pasado nada). Corre con la misma cuenta que `RoundTimer`,
 * en el hilo de UI. El latido es un bucle que se pausa sin foco, en segundo plano, con el
 * reloj en pausa y con reducir movimiento (queda la barra fija en `accent`).
 */
export function RelojRonda({ segundos, llave, onFin, pausado = false, etiqueta = 'Reloj del tablero' }: Props) {
  const { activo, reducido } = useSenalActiva();
  const avance = useCuentaRegresiva({ segundos, llave, onFin, pausado });

  const [enUltimoTramo, setEnUltimoTramo] = useState(false);
  useAnimatedReaction(
    () => avance.value > ULTIMO_TRAMO,
    (ahora, antes) => {
      if (ahora !== antes) runOnJS(setEnUltimoTramo)(ahora);
    }
  );
  const latido = useReloj(motionSenal.latido, { activo: enUltimoTramo && !pausado && activo, reducido });

  const barra = useAnimatedStyle(() => {
    const final = avance.value > ULTIMO_TRAMO;
    const pulso = final && !reducido ? OPACIDAD_MINIMA + (1 - OPACIDAD_MINIMA) * (0.5 - 0.5 * Math.cos(2 * Math.PI * latido.value)) : 1;
    return {
      width: `${Math.max(0, (1 - avance.value) * 100)}%`,
      backgroundColor: final ? ACENTO : APAGADO,
      opacity: pulso,
    };
  });

  return (
    <View style={styles.fila} accessible accessibilityRole="timer" accessibilityLabel={etiqueta}>
      <Icon name="clock" size="sm" color={color.textMuted} />
      <View style={styles.pista}>
        <Animated.View style={[styles.relleno, barra]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pista: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: color.trackFondo, overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: radius.pill },
});
