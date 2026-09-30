import { analizar, type Palabra } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import { useVozEnVivo, type VozEnVivo } from './useVozEnVivo';

export interface VozFrase {
  /** La voz que suena ahora: la lenta si es la que está sonando, si no la natural. */
  voz: VozEnVivo;
  /** Las palabras de la frase con sus tiempos, los del audio que corresponde a `voz`. */
  palabras: Palabra[];
  sonandoNormal: boolean;
  sonandoLenta: boolean;
}

/**
 * Una frase con dos audios (la natural y la lenta, que son archivos distintos) lista para `FraseKaraoke`: escucha las
 * dos voces y devuelve la que suena con las palabras y los tiempos de su audio. No reproduce nada.
 */
export function useVozFrase(texto: string, ruta: string, rutaLenta: string): VozFrase {
  const normal = useVozEnVivo(ruta);
  const lenta = useVozEnVivo(rutaLenta);
  const analisisNormal = analizar(texto, texto, marcasDe(ruta), normal.duracion);
  const analisisLento = analizar(texto, texto, marcasDe(rutaLenta), lenta.duracion);
  const conLenta = lenta.sonando;
  return {
    voz: conLenta ? lenta : normal,
    palabras: (conLenta ? analisisLento : analisisNormal).palabras,
    sonandoNormal: normal.sonando,
    sonandoLenta: lenta.sonando,
  };
}
