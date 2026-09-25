import { useEffect, useRef, useState } from 'react';
import { estrellasNuevas } from '@/domain/niveles';

/** Lo que había en el mapa la última vez que se vio, por juego: para saber qué cambió al volver. */
interface Foto {
  estrellas: Map<number, number>;
  siguiente: number;
}
const fotos = new Map<string, Foto>();

/** Las estrellas que ganó un nivel desde la última vez. `id` cambia con cada logro nuevo. */
export interface Logro {
  antes: number;
  ahora: number;
  id: number;
}

export interface Recompensa {
  id: number;
  /** Los niveles que ganaron estrellas. */
  logros: ReadonlyMap<number, Logro>;
  /** El nivel actual cambió: el anillo salta al nuevo. */
  saltoActual: boolean;
}

export const SIN_RECOMPENSA: Recompensa = { id: 0, logros: new Map(), saltoActual: false };

/**
 * Qué cambió en el mapa desde la última vez que se vio, sin tocar la navegación ni la
 * lógica de estrellas: GameEnd vuelve a Practicar (cierra este mapa), así que en lugar de
 * pasar el nivel jugado por parámetros se compara la foto de la última visita (en memoria,
 * mientras la app vive) con lo que hay ahora. La primera vez que se ve el mapa no hay foto
 * y no hay nada que celebrar. Las estrellas solo suben, así que nunca celebra una baja.
 */
export function useRecompensaNiveles(
  juego: string,
  estrellas: ReadonlyMap<number, number>,
  siguiente: number,
  hayDatos: boolean
): Recompensa {
  const [recompensa, setRecompensa] = useState<Recompensa>(SIN_RECOMPENSA);
  const contador = useRef(0);

  useEffect(() => {
    if (!hayDatos) return;
    const previa = fotos.get(juego);
    const nuevas = estrellasNuevas(previa?.estrellas, estrellas);
    const salto = previa !== undefined && previa.siguiente !== siguiente;
    fotos.set(juego, { estrellas: new Map(estrellas), siguiente });
    if (nuevas.length === 0 && !salto) return;
    const id = ++contador.current;
    setRecompensa({
      id,
      saltoActual: salto,
      logros: new Map(nuevas.map((n) => [n.nivel, { antes: n.antes, ahora: n.ahora, id }] as const)),
    });
  }, [juego, estrellas, siguiente, hayDatos]);

  return recompensa;
}
