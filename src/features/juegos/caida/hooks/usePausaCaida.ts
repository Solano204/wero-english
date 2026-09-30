import { useCallback, useRef, useState, type Dispatch, type RefObject } from 'react';
import type { EventoPartida } from '@/features/juegos/caida/logic/partida';
import * as audio from '@/services/audio';
import type { Entry } from '@/types';

/**
 * Tope duro de la pausa de fin de ronda (acierto o fallo): si el audio
 * no carga o se atora, esto la suelta de todos modos. Tiempo de sobra
 * para oír la frase completa en inglés y en español.
 */
const PAUSA_MAXIMA_MS = 10000;
/** Respiro tras la voz antes de seguir a la ronda siguiente. */
const RESPIRO_MS = 300;
/** Respiro tras la voz de una ronda perdida, antes de la pantalla final. */
const RESPIRO_PERDIDA_MS = 500;
/** Bloqueo de "Siguiente" en la pausa contra doble toque. */
const AVANZAR_DEBOUNCE_MS = 400;

/**
 * La pausa de fin de ronda de Caída: congela la partida, dice la frase y corre lo que sigue una sola vez
 * (el token evita que la voz, «Siguiente» y el tope avancen dos veces).
 */
export function usePausaCaida(despachar: Dispatch<EventoPartida>, montado: RefObject<boolean>, alSoltar: () => void) {
  const [avanzando, setAvanzando] = useState(false);
  const candadoAvanzar = useRef(false);
  // Qué hacer cuando la pausa termina (ronda siguiente, o pasar al
  // resultado si se perdió), fuera de React: lo lee tanto el fin
  // natural de la voz como "Siguiente".
  const pausaCtx = useRef<(() => void) | null>(null);
  // Token de la pausa vigente: uno nuevo invalida cualquier voz o
  // temporizador en camino de una pausa anterior.
  const pausaToken = useRef(0);
  const limiteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avanzarDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Termina la pausa de fin de ronda y corre lo que tocaba: ronda
   * siguiente, o pasar al resultado si se perdió. La llaman tanto el
   * final natural de la voz como "Siguiente" y el tope de
   * PAUSA_MAXIMA_MS; el token evita que dos de ellos avancen dos veces.
   */
  const avanzarTrasPausa = useCallback(
    (miToken: number) => {
      if (pausaToken.current !== miToken) return;
      pausaToken.current++;
      if (limiteTimer.current) clearTimeout(limiteTimer.current);
      audio.stop();

      const continuar = pausaCtx.current;
      pausaCtx.current = null;
      if (!montado.current) return;
      despachar({ tipo: 'soltarPausa' });
      alSoltar();
      continuar?.();
    },
    [despachar, montado, alSoltar]
  );

  /**
   * Pausa de fin de ronda: congela la caída, muestra la frase correcta y
   * dice la frase completa en inglés y en español, siempre (sin mirar
   * "Audio automático") y sin importar si la ronda se ganó o se perdió.
   * Al terminar (voz completa, tope de PAUSA_MAXIMA_MS, o "Siguiente" a
   * mano) corre `continuar`.
   */
  const pausarConVoz = useCallback(
    async (entry: Entry, correct: boolean, continuar: () => void) => {
      const miToken = ++pausaToken.current;
      pausaCtx.current = continuar;
      despachar({ tipo: 'pausar', entry, correct });

      limiteTimer.current = setTimeout(
        () => avanzarTrasPausa(miToken),
        PAUSA_MAXIMA_MS
      );

      await audio.playRoundResultBilingue(correct, entry.audio_en, entry.audio_es);
      if (pausaToken.current !== miToken) return; // ya lo cerró otra vía

      await new Promise((r) => setTimeout(r, correct ? RESPIRO_MS : RESPIRO_PERDIDA_MS));
      avanzarTrasPausa(miToken);
    },
    [avanzarTrasPausa, despachar]
  );

  /** Botón "Siguiente ›" de la pausa: corta la voz y avanza ya. */
  const tocarSiguienteEnPausa = useCallback(() => {
    if (candadoAvanzar.current) return;
    candadoAvanzar.current = true;
    setAvanzando(true);
    try {
      avanzarTrasPausa(pausaToken.current);
    } finally {
      // El candado se suelta siempre, pase lo que pase al avanzar.
      if (avanzarDebounce.current) clearTimeout(avanzarDebounce.current);
      avanzarDebounce.current = setTimeout(() => {
        candadoAvanzar.current = false;
        setAvanzando(false);
      }, AVANZAR_DEBOUNCE_MS);
    }
  }, [avanzarTrasPausa]);

  /** Al desmontar: nada de la pausa en camino puede seguir. */
  const invalidarPausa = useCallback(() => {
    pausaToken.current++;
  }, []);
  const limpiarTemporizadores = useCallback(() => {
    if (limiteTimer.current) clearTimeout(limiteTimer.current);
    if (avanzarDebounce.current) clearTimeout(avanzarDebounce.current);
  }, []);

  return { avanzando, pausarConVoz, tocarSiguienteEnPausa, invalidarPausa, limpiarTemporizadores };
}
