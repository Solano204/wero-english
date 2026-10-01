import { shuffle } from '@/domain/arreglos';
import type { Entry, ParFicha, ParesTablero } from '@/types';

/**
 * Pares: un tablero de fichas donde cada frase en inglés tiene su
 * significado en español, y se juntan de dos en dos.
 *
 * Es la mecánica que se vio en la competencia, con una diferencia que
 * cambia lo que es: allá el tablero se arma de una lista fija de
 * palabras sueltas, aquí se arma de las tarjetas que le tocan hoy al
 * usuario. Jugar adelanta la cola en vez de robarle tiempo.
 *
 * Se califica como reconocimiento, nunca como producción: acertar un
 * tablero de ocho fichas por descarte no es recordar la frase en frío.
 */

export const PARES_POR_TABLERO = 8;

/** Presupuesto de jugadas. Generoso a propósito: no hay forma de perder. */
export const JUGADAS_EXTRA = 4;

export function buildTablero(
  pool: Entry[],
  pares: number = PARES_POR_TABLERO
): ParesTablero {
  const elegidas = shuffle(pool.filter(esUsable)).slice(0, pares);

  const fichas: ParFicha[] = [];
  for (const e of elegidas) {
    fichas.push({
      id: `en-${e.id}`,
      entryId: e.id,
      texto: e.phrase,
      lado: 'en',
    });
    fichas.push({
      id: `es-${e.id}`,
      entryId: e.id,
      texto: e.spanish_main,
      lado: 'es',
    });
  }

  return {
    fichas: shuffle(fichas),
    totalPares: elegidas.length,
    jugadas: elegidas.length + JUGADAS_EXTRA,
  };
}

/**
 * Una frase que no cabe en una ficha rompe el tablero: se corta el
 * texto y las dos mitades se ven iguales. El filtro va aquí y no en el
 * SQL para que la regla viva junto al juego que la necesita.
 */
function esUsable(e: Entry): boolean {
  if (e.word_count > 4) return false;
  if (e.phrase.length > 26) return false;
  if (e.spanish_main.length > 30) return false;
  return true;
}

/** ¿Estas dos fichas son pareja? Dos del mismo lado nunca lo son. */
export function sonPareja(a: ParFicha, b: ParFicha): boolean {
  if (a.id === b.id) return false;
  if (a.lado === b.lado) return false;
  return a.entryId === b.entryId;
}
