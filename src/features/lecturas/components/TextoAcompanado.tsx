import React, { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { Trozo } from '@/domain/lectura';
import { indiceEn, type Oracion as OracionTexto } from '@/domain/oraciones';
import { color, motionDuration, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { Oracion } from './Oracion';

/** Dónde quedó cada oración del texto (dp, dentro del contenido del scroll) y dónde termina el texto. */
export interface MedidasTexto {
  /** Coordenada, dentro del contenido del scroll, donde empieza el texto. */
  base: number;
  ys: number[];
  hs: number[];
  /** Alto total del texto. */
  alto: number;
}

/**
 * La oración que suena, en el hilo de UI: la última que ya empezó según `inicios` (el instante de cada una) y la posición
 * del audio. Vale -1 mientras el capítulo no suena ni está en pausa.
 */
export function useOracionActual(
  inicios: readonly number[],
  pos: SharedValue<number>,
  enCurso: SharedValue<number>
): SharedValue<number> {
  const actual = useSharedValue(-1);
  useAnimatedReaction(
    () => (enCurso.get() === 1 ? indiceEn(inicios, pos.get()) : -1),
    (ahora, antes) => {
      if (ahora !== antes) actual.set(ahora);
    },
    [inicios]
  );
  return actual;
}

interface Props {
  oraciones: OracionTexto[];
  /** Los trozos de cada oración (texto suelto y frases del catálogo), en el mismo orden. */
  porOracion: Trozo[][];
  actual: SharedValue<number>;
  enCurso: SharedValue<number>;
  /** El capítulo tiene audio: las oraciones ofrecen «Escuchar desde aquí». */
  conAudio: boolean;
  /** Abre la ficha de una frase del catálogo (después del pulso de 150 ms). */
  onFrase: (entryId: number) => void;
  /** Se tocó una oración. */
  onOracion: (indice: number) => void;
  /** Avisa dónde quedó cada oración, para seguir el audio con el scroll. */
  alMedir?: (m: MedidasTexto) => void;
}

/**
 * El texto de un capítulo, oración por oración. Detrás de las oraciones hay un solo resaltado `accentSoft` que se desliza
 * (y cambia de alto) hasta la que suena; la que suena va en `text` y las demás bajan a `textMuted` (lo hace cada
 * `Oracion` leyendo el valor compartido `actual`). Las posiciones salen de medir cada oración: el resaltado y el scroll
 * usan las reales, nunca un alto supuesto. Al tocar una frase del catálogo su oración pulsa 150 ms antes de abrir la
 * ficha. Con «reducir movimiento» el resaltado cambia de lugar sin deslizarse y no hay pulso.
 */
export const TextoAcompanado = memo(function TextoAcompanado({
  oraciones,
  porOracion,
  actual,
  enCurso,
  conAudio,
  onFrase,
  onOracion,
  alMedir,
}: Props) {
  const reducido = useMovimientoReducido();
  const medidas = useRef<{ y: number; alto: number }[]>([]);
  const contenedor = useRef({ y: 0, alto: 0 });
  const programado = useRef<number | null>(null);
  const ys = useSharedValue<number[]>([]);
  const hs = useSharedValue<number[]>([]);
  const hy = useSharedValue(0);
  const hh = useSharedValue(0);
  const hop = useSharedValue(0);
  const pulso = useSharedValue(0);
  const iPulso = useSharedValue(-1);

  const sincronizar = useCallback(() => {
    programado.current = null;
    const n = oraciones.length;
    const nuevasYs = Array.from({ length: n }, (_, k) => medidas.current[k]?.y ?? -1);
    const nuevasHs = Array.from({ length: n }, (_, k) => medidas.current[k]?.alto ?? 0);
    ys.set(nuevasYs);
    hs.set(nuevasHs);
    alMedir?.({ base: contenedor.current.y, ys: nuevasYs, hs: nuevasHs, alto: contenedor.current.alto });
  }, [oraciones.length, ys, hs, alMedir]);

  // Las medidas llegan una por oración: se juntan y se publican una vez por cuadro.
  const programar = useCallback(() => {
    if (programado.current === null) programado.current = requestAnimationFrame(sincronizar);
  }, [sincronizar]);

  const alMedirOracion = useCallback(
    (indice: number, y: number, alto: number) => {
      medidas.current[indice] = { y, alto };
      programar();
    },
    [programar]
  );

  useEffect(
    () => () => {
      if (programado.current !== null) cancelAnimationFrame(programado.current);
      cancelAnimation(pulso);
      cancelAnimation(hy);
      cancelAnimation(hh);
      cancelAnimation(hop);
    },
    [pulso, hy, hh, hop]
  );

  // El resaltado se desliza hasta la oración que suena; la primera vez que aparece no viaja, aparece ahí.
  useAnimatedReaction(
    () => {
      const i = actual.get();
      return { i, y: i >= 0 ? ys.get()[i] ?? -1 : -1, h: i >= 0 ? hs.get()[i] ?? 0 : 0 };
    },
    (r, antes) => {
      if (r.i < 0 || r.y < 0) {
        hop.set(reducido ? 0 : withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir }));
        return;
      }
      const sinViaje = reducido || !antes || antes.i < 0 || antes.y < 0;
      if (sinViaje) {
        hy.set(r.y);
        hh.set(r.h);
      } else {
        hy.set(withTiming(r.y, { duration: motionDuration.base, easing: motionEasing.entrar }));
        hh.set(withTiming(r.h, { duration: motionDuration.base, easing: motionEasing.entrar }));
      }
      hop.set(reducido ? 1 : withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
    },
    [reducido]
  );

  const estiloResaltado = useAnimatedStyle(() => ({
    opacity: hop.get(),
    height: hh.get(),
    transform: [{ translateY: hy.get() }],
  }));
  const estiloPulso = useAnimatedStyle(() => {
    const i = iPulso.get();
    return {
      opacity: pulso.get() * 0.3,
      height: i >= 0 ? hs.get()[i] ?? 0 : 0,
      transform: [{ translateY: i >= 0 ? ys.get()[i] ?? 0 : 0 }],
    };
  });

  const alFrase = useCallback(
    (entryId: number, indice: number) => {
      if (reducido || pulso.get() > 0 || (ys.get()[indice] ?? -1) < 0) {
        if (pulso.get() === 0) onFrase(entryId);
        return;
      }
      iPulso.set(indice);
      pulso.set(0);
      pulso.set(withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }, (fin) => {
        if (!fin) return;
        pulso.set(0);
        runOnJS(onFrase)(entryId);
      }));
    },
    [reducido, pulso, iPulso, ys, onFrase]
  );

  return (
    <View
      style={styles.texto}
      onLayout={(e) => {
        contenedor.current = { y: e.nativeEvent.layout.y, alto: e.nativeEvent.layout.height };
        programar();
      }}
    >
      <Animated.View pointerEvents="none" style={[styles.resaltado, estiloResaltado]} />
      <Animated.View pointerEvents="none" style={[styles.pulso, estiloPulso]} />
      {oraciones.map((o, i) => (
        <Oracion
          key={i}
          indice={i}
          trozos={porOracion[i] ?? []}
          separada={i > 0 && o.parrafo !== oraciones[i - 1]?.parrafo}
          actual={actual}
          enCurso={enCurso}
          conAudio={conAudio}
          alFrase={alFrase}
          alOracion={onOracion}
          alMedir={alMedirOracion}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  texto: { marginBottom: space.lg },
  // Los dos van detrás del texto y un poco más anchos que él: el resaltado abraza a la oración sin mover el texto.
  resaltado: {
    position: 'absolute',
    top: 0,
    left: -space.sm,
    right: -space.sm,
    borderRadius: radius.sm,
    backgroundColor: color.accentSoft,
  },
  pulso: {
    position: 'absolute',
    top: 0,
    left: -space.sm,
    right: -space.sm,
    borderRadius: radius.sm,
    backgroundColor: color.accent,
  },
});
