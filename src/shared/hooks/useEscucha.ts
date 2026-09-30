import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import * as speech from '@/services/voz';
import type { ResultadoEscucha } from '@/services/voz';
import { conFinalAsync } from '@/shared/utils/conFinal';

export type FaseEscucha = 'inactivo' | speech.EstadoEscucha;

/** Si en este tiempo (desde que ya escucha) no llega voz, se avisa que no se oye. */
const SIN_VOZ_MS = 2000;
/** Volumen (−2 a 10) a partir del cual se considera que hay voz y no solo ruido de fondo. */
export const UMBRAL_VOZ = 2;
/** Cuánto tarda el medidor en seguir al volumen: un poco más que el intervalo del evento, para que no tiemble. */
const SUAVIZADO_MS = 90;

/**
 * Una escucha a la vez, con su fase («Preparando…» → «Te escucho» → «Procesando…»), el volumen para el medidor (0 a 1,
 * en un valor compartido: no repinta la pantalla), el último parcial y el aviso de «no te escucho». `escuchar` no hace
 * nada si ya hay una escucha en curso: el botón no se puede tocar dos veces.
 */
export function useEscucha() {
  const [fase, setFase] = useState<FaseEscucha>('inactivo');
  const [sinVoz, setSinVoz] = useState(false);
  const [parcial, setParcial] = useState<string | null>(null);
  const nivel = useSharedValue(0);
  const enCurso = useRef(false);
  const vivo = useRef(true);
  const volumenMax = useRef(-2);
  const relojSinVoz = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarReloj = () => {
    if (relojSinVoz.current) clearTimeout(relojSinVoz.current);
    relojSinVoz.current = null;
  };

  useEffect(
    () => () => {
      vivo.current = false;
      limpiarReloj();
      speech.cancel();
    },
    []
  );

  const escuchar = useCallback(
    async (candidatos: string[]): Promise<ResultadoEscucha | null> => {
      if (enCurso.current) return null;
      enCurso.current = true;
      volumenMax.current = -2;
      setSinVoz(false);
      setParcial(null);
      nivel.set(0);
      return await conFinalAsync(async () => {
        return await speech.listenOnce({
          candidatos,
          onEstado: (e) => {
            if (!vivo.current) return;
            setFase(e);
            if (e === 'escuchando') {
              limpiarReloj();
              relojSinVoz.current = setTimeout(() => {
                if (vivo.current && volumenMax.current < UMBRAL_VOZ) setSinVoz(true);
              }, SIN_VOZ_MS);
            } else {
              limpiarReloj();
              nivel.set(withTiming(0, { duration: SUAVIZADO_MS }));
            }
          },
          onVolumen: (v) => {
            if (v > volumenMax.current) volumenMax.current = v;
            if (v >= UMBRAL_VOZ && vivo.current) setSinVoz(false);
            nivel.set(withTiming(Math.min(1, Math.max(0, v / 10)), { duration: SUAVIZADO_MS }));
          },
          onParcial: (t) => {
            if (vivo.current) setParcial(t);
          },
        });
      }, () => {
        enCurso.current = false;
        limpiarReloj();
        nivel.set(0);
        if (vivo.current) {
          setFase('inactivo');
          setSinVoz(false);
        }
      });
    },
    [nivel]
  );

  return { fase, ocupado: fase !== 'inactivo', sinVoz, parcial, nivel, escuchar };
}
