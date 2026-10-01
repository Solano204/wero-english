import { useVozEnVivo, type VozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import type { Entry } from '@/types';

/**
 * La voz de la frase de la ronda y su análisis (palabras con tiempos y la energía de la onda). Una sola vez
 * por pantalla: la comparten el botón de escuchar (la onda) y la frase resuelta (el karaoke). Escucha desde
 * que hay frase: el audio arranca al escuchar o al resolver y no espera a ninguna animación.
 */
export function useVozRonda(entry: Entry | null) {
  const voz: VozEnVivo = useVozEnVivo(entry?.audio_en ?? null);
  const analisis = (entry
        ? // Lo que se dice puede diferir de lo que se ve; los tiempos se calculan sobre lo dicho.
          analizar(entry.phrase, entry.phrase_tts || entry.phrase, marcasDe(entry.audio_en), voz.duracion)
        : null);
  return { voz, analisis };
}
