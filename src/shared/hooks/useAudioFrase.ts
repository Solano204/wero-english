import { useCallback, useMemo } from 'react';
import { useVozEnVivo, type VozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar, type Palabra } from '@/domain/marcas';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { marcasDe } from '@/services/marcas';
import type { Entry } from '@/types';
import type { ControlAudio } from '@/shared/ui/GrupoAudio';

export interface AudioFrase {
  /** La voz del inglés y las palabras de la frase con sus tiempos, para el karaoke. */
  vozEn: VozEnVivo;
  palabras: Palabra[];
  /** El grupo segmentado Inglés · Español (sin Español si la frase no trae audio en español). */
  controles: ControlAudio[];
  /** Reproduce un audio con el toque ligero de siempre. */
  sonar: (ruta: string) => void;
  /** Las acciones «Escuchar en inglés» y «Escuchar en español» para el lector de pantalla. */
  acciones: { name: string; label: string }[];
  /** Atiende una de esas acciones; dice si era suya. */
  atender: (nombre: string) => boolean;
}

/**
 * Lo que una tarjeta con una frase suelta necesita para sonar: el karaoke del inglés, el grupo segmentado Inglés · Español
 * con su estado «suena» y las acciones del lector de pantalla. Lo usan las tarjetas de Mi mazo y de Se me atoran. No
 * reproduce nada por su cuenta.
 */
export function useAudioFrase(entry: Entry): AudioFrase {
  const vozEn = useVozEnVivo(entry.audio_en);
  const vozEs = useVozEnVivo(entry.audio_es);
  const hablado = entry.phrase_tts || entry.phrase;
  const { palabras } = useMemo(
    () => analizar(entry.phrase, hablado, marcasDe(entry.audio_en), vozEn.duracion),
    [entry.phrase, hablado, entry.audio_en, vozEn.duracion]
  );

  const sonar = useCallback((ruta: string) => {
    haptics.tapLight();
    void audio.play(ruta);
  }, []);

  const controles: ControlAudio[] = [
    { clave: 'en', etiqueta: 'Inglés', descripcion: 'Escuchar en inglés', icono: 'play', ruta: entry.audio_en, lento: false, suena: vozEn.sonando },
    ...(entry.audio_es
      ? [{ clave: 'es', etiqueta: 'Español', descripcion: 'Escuchar en español', icono: 'play' as const, ruta: entry.audio_es, lento: false, suena: vozEs.sonando }]
      : []),
  ];
  const acciones = [
    { name: 'ingles', label: 'Escuchar en inglés' },
    ...(entry.audio_es ? [{ name: 'espanol', label: 'Escuchar en español' }] : []),
  ];
  const atender = (nombre: string): boolean => {
    if (nombre === 'ingles') sonar(entry.audio_en);
    else if (nombre === 'espanol' && entry.audio_es) sonar(entry.audio_es);
    else return false;
    return true;
  };

  return { vozEn, palabras, controles, sonar, acciones, atender };
}
