import { useRef } from 'react';
import * as audio from '@/services/audio';
import type { Entry } from '@/types';

/** Entre matches muy seguidos, no suena más de una voz cada tanto. */
const VOZ_MATCH_THROTTLE_MS = 700;

/**
 * Voz del match: audio.play() ya invalida por su cuenta cualquier
 * reproducción anterior (su propio token), así que un match nuevo
 * nunca queda encimado con el de antes. El throttle es aparte: entre
 * toques muy seguidos evita una voz por cada uno, dejando sonar solo
 * la más reciente cuando pasa la ventana.
 */
export function useVozMatch(autoAudio: boolean) {
  const ultimaVozMatch = useRef(0);
  const vozMatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reproducirVozMatch = (entry: Entry) => {
    if (!autoAudio) return;
    if (vozMatchTimer.current) {
      clearTimeout(vozMatchTimer.current);
      vozMatchTimer.current = null;
    }
    const ahora = Date.now();
    const falta = VOZ_MATCH_THROTTLE_MS - (ahora - ultimaVozMatch.current);
    if (falta <= 0) {
      ultimaVozMatch.current = ahora;
      void audio.play(entry.audio_en);
    } else {
      vozMatchTimer.current = setTimeout(() => {
        ultimaVozMatch.current = Date.now();
        void audio.play(entry.audio_en);
      }, falta);
    }
  };

  /** La voz de match que se quedó esperando su turno ya no suena. */
  const cancelarVozMatch = (soltar: boolean) => {
    if (!vozMatchTimer.current) return;
    clearTimeout(vozMatchTimer.current);
    if (soltar) vozMatchTimer.current = null;
  };

  return { reproducirVozMatch, cancelarVozMatch };
}
