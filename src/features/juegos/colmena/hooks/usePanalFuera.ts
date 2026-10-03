import { useEffect, useState } from 'react';
import { CAE_TOPE_MS } from '@/features/juegos/colmena/components/Panal';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { motionColmena, motionDuration } from '@/theme';

/**
 * Con la ronda resuelta, el panal se va (llega la última ficha y caen los señuelos) y recién entonces la frase toma su
 * lugar. Nunca los dos a la vez: la frase encima de las fichas no se leía. Lo decide un reloj de React y no la
 * animación, así una ficha que no llegó a desvanecerse tampoco tapa la frase.
 *
 * El panal solo está «fuera» si la ronda de verdad se resolvió: el resultado exige `resuelta`, así que con una
 * ronda nueva (o en juego) siempre se ve, aunque el estado del reloj todavía traiga el valor de la ronda anterior.
 */
export function usePanalFuera(resuelta: boolean, aterrizaMs: number): boolean {
  const reducido = useMovimientoReducido();
  const [fuera, setFuera] = useState(false);
  useEffect(() => {
    if (!resuelta) {
      setFuera(false);
      return undefined;
    }
    const espera = aterrizaMs + (reducido ? motionDuration.rapido : motionColmena.cae + CAE_TOPE_MS);
    const t = setTimeout(() => setFuera(true), espera);
    return () => clearTimeout(t);
  }, [resuelta, aterrizaMs, reducido]);
  return resuelta && fuera;
}
