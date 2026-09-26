import { useMemo } from 'react';
import { useVozEnVivo } from '@/components/fx';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import type { CazalaItem } from '@/types';

/**
 * Las dos voces de la ronda, la natural y la lenta (son audios distintos), cada una con su análisis: las palabras
 * con sus tiempos y la energía de la onda. Escuchan desde que hay ronda; el audio nunca espera a una animación.
 */
export function useVozCaza(item: CazalaItem | undefined) {
  const voz = useVozEnVivo(item?.audio ?? null);
  const vozLenta = useVozEnVivo(item?.audio_lento ?? null);
  const analisis = useMemo(
    () => (item ? analizar(item.frase_real, item.frase_real, marcasDe(item.audio), voz.duracion) : null),
    [item, voz.duracion]
  );
  const analisisLento = useMemo(
    () => (item ? analizar(item.frase_real, item.frase_real, marcasDe(item.audio_lento), vozLenta.duracion) : null),
    [item, vozLenta.duracion]
  );
  return { voz, vozLenta, analisis, analisisLento };
}
