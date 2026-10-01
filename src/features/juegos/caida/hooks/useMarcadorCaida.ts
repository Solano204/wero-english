import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { View } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { motionDuration, motionEasing, motionLogro } from '@/theme';

/** Tope del vuelo de la ficha acertada hasta el marcador (unos 470 ms): pasado esto el marcador se actualiza igual. */
const VUELO_MAXIMO_MS = 1200;

/**
 * La ficha acertada vuela al marcador: mientras tanto el marcador muestra el número de antes y la
 * pausa espera. `destino` es el centro del marcador en el espacio de la pista.
 */
export function useMarcadorCaida(
  volando: boolean,
  setVolando: Dispatch<SetStateAction<boolean>>,
  altoPista: number,
  reducido: boolean
) {
  const [destino, setDestino] = useState<{ x: number; y: number } | null>(null);
  const capaRef = useRef<View>(null);
  const pistaRef = useRef<View>(null);
  const marcadorRef = useRef<View>(null);
  const pulsoMarcador = useSharedValue(0);

  /** El centro del marcador respecto de la pista: a donde vuela la ficha acertada. Se mide contra la capa común. */
  const medirDestino = useCallback(() => {
    const capa = capaRef.current;
    const marcador = marcadorRef.current;
    const pista = pistaRef.current;
    if (!capa || !marcador || !pista) return;
    marcador.measureLayout(
      capa,
      (mx, my, mw, mh) =>
        pista.measureLayout(
          capa,
          (px, py) =>
            setDestino((d) => {
              const x = mx + mw / 2 - px;
              const yc = my + mh / 2 - py;
              return d && d.x === x && d.y === yc ? d : { x, y: yc };
            }),
          () => undefined
        ),
      () => undefined
    );
  }, []);

  /** La ficha acertada llegó: el marcador rueda al número nuevo y pulsa 1 → 1.06 → 1. */
  const alLlegarFicha = () => {
    setVolando(false);
    if (reducido) return;
    pulsoMarcador.set(withSequence(
      withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
    ));
  };

  // Si la ficha no avisa que llegó (app en segundo plano a mitad del vuelo), el marcador se actualiza igual.
  useEffect(() => {
    if (!volando) return undefined;
    const t = setTimeout(() => setVolando(false), VUELO_MAXIMO_MS);
    return () => clearTimeout(t);
  }, [volando, setVolando]);

  useEffect(() => {
    medirDestino();
  }, [medirDestino, altoPista]);

  // 1 → `motionLogro.escala` → 1: la misma escala con la que pulsa un logro en Niveles.
  const pulsoAnim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (motionLogro.escala - 1) * pulsoMarcador.get() }],
  }));

  return { destino, capaRef, pistaRef, marcadorRef, medirDestino, alLlegarFicha, pulsoAnim };
}
