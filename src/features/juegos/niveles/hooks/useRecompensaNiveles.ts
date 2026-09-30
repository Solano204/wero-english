import { useEffect, useState } from 'react';
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
  /** 0 mientras no haya nada que celebrar; sube con cada celebración nueva. */
  id: number;
  /** Los niveles que ganaron estrellas. */
  logros: ReadonlyMap<number, Logro>;
  /** Cuántas estrellas se ganaron en total (para que el contador del encabezado ruede hasta la cifra nueva). */
  ganadas: number;
  /** El nivel actual cambió: el anillo salta al nuevo. */
  saltoActual: boolean;
}

export const SIN_RECOMPENSA: Recompensa = { id: 0, logros: new Map(), ganadas: 0, saltoActual: false };

/**
 * Qué cambió en el mapa desde la última vez que se vio, sin tocar la navegación ni la
 * lógica de estrellas: GameEnd vuelve a Practicar (cierra este mapa), así que en lugar de
 * pasar el nivel jugado por parámetros se compara la foto de la última visita (en memoria,
 * mientras la app vive) con lo que hay ahora. La primera vez que se ve el mapa no hay foto
 * y no hay nada que celebrar. Las estrellas solo suben, así que nunca celebra una baja.
 *
 * Se calcula al renderizar (no en un efecto) para que el encabezado pueda arrancar en la
 * cifra vieja desde el primer cuadro, sin un destello de la nueva. La celebración se queda
 * hasta que llegue otra: recargar sin novedades no la borra a media animación.
 */
export function useRecompensaNiveles(
  juego: string,
  estrellas: ReadonlyMap<number, number>,
  siguiente: number,
  hayDatos: boolean
): Recompensa {
  // Se recalcula en el render en que cambian los datos (estado ajustado durante el render, no una ref).
  const [calculo, setCalculo] = useState(() => ({
    juego,
    estrellas,
    siguiente,
    hayDatos,
    recompensa: recompensaNueva(juego, estrellas, siguiente, hayDatos, SIN_RECOMPENSA.id) ?? SIN_RECOMPENSA,
  }));
  let recompensa = calculo.recompensa;
  if (calculo.juego !== juego || calculo.estrellas !== estrellas || calculo.siguiente !== siguiente || calculo.hayDatos !== hayDatos) {
    recompensa = recompensaNueva(juego, estrellas, siguiente, hayDatos, recompensa.id) ?? recompensa;
    setCalculo({ juego, estrellas, siguiente, hayDatos, recompensa });
  }

  // La foto se actualiza después de pintar: el próximo cálculo compara contra lo que ya se vio.
  useEffect(() => {
    if (hayDatos) fotos.set(juego, { estrellas: new Map(estrellas), siguiente });
  }, [juego, estrellas, siguiente, hayDatos]);

  return recompensa;
}

/** Lo que hay que celebrar contra la foto de la última visita, o null si no hay nada nuevo. */
function recompensaNueva(
  juego: string,
  estrellas: ReadonlyMap<number, number>,
  siguiente: number,
  hayDatos: boolean,
  idAnterior: number
): Recompensa | null {
  if (!hayDatos) return null;
  const previa = fotos.get(juego);
  const nuevas = estrellasNuevas(previa?.estrellas, estrellas);
  const salto = previa !== undefined && previa.siguiente !== siguiente;
  if (nuevas.length === 0 && !salto) return null;
  const id = idAnterior + 1;
  return {
    id,
    saltoActual: salto,
    ganadas: nuevas.reduce((suma, n) => suma + (n.ahora - n.antes), 0),
    logros: new Map(nuevas.map((n) => [n.nivel, { antes: n.antes, ahora: n.ahora, id }] as const)),
  };
}
