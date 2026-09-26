import { useEffect, useMemo, useRef, useState } from 'react';
import { cancelAnimation, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useVozEnVivo } from '@/components/fx';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import { motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { CazalaItem } from '@/types';

/** Cuánto se espera a que arranque la voz de la revisión (suena después del efecto) antes de correr el reloj propio. */
const ARRANQUE_MAX_MS = 2500;
/** Si no se conoce ni una palabra de la frase, el reloj propio dura esto (s). */
const FIN_POR_OMISION_S = 2;

/**
 * Las dos voces de la ronda, la natural y la lenta (son audios distintos), cada una con su análisis: las palabras
 * con sus tiempos y la energía de la onda. Escuchan desde que hay ronda; el audio nunca espera a una animación.
 *
 * También da `posRevision`, la posición que siguen los pulsos y la transformación de las reducciones al revisar: la
 * del audio cuando suena la frase y, si no suena (sin audio automático, o el audio no arrancó), la de un reloj
 * propio que recorre la frase en el mismo tiempo estimado. Con «reducir movimiento» no corre ninguno.
 */
export function useVozCaza(item: CazalaItem | undefined, revisada: boolean, autoAudio: boolean) {
  const reducido = useMovimientoReducido();
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

  const posReloj = useSharedValue(-1);
  const [conReloj, setConReloj] = useState(false);
  const arranco = useRef(false);
  const analisisRef = useRef(analisis);
  analisisRef.current = analisis;

  useEffect(() => {
    if (revisada && voz.sonando) arranco.current = true;
  }, [revisada, voz.sonando]);

  useEffect(() => {
    if (!revisada || reducido) return undefined;
    const correr = () => {
      const fin = Math.max(0, ...(analisisRef.current?.palabras.map((p) => p.sig) ?? [])) || FIN_POR_OMISION_S;
      setConReloj(true);
      posReloj.value = 0;
      posReloj.value = withTiming(fin, { duration: fin * 1000, easing: motionEasing.lineal });
    };
    const espera = setTimeout(() => {
      if (!arranco.current) correr();
    }, autoAudio ? ARRANQUE_MAX_MS : 0);
    return () => {
      clearTimeout(espera);
      cancelAnimation(posReloj);
      posReloj.value = -1;
      setConReloj(false);
      arranco.current = false;
    };
  }, [revisada, autoAudio, reducido, item?.id, posReloj]);

  const posRevision: SharedValue<number> = conReloj ? posReloj : voz.pos;
  return { voz, vozLenta, analisis, analisisLento, posRevision };
}
