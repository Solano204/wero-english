import type { ContentFilter } from '@/db/cola';
import type { Nivel } from '@/types';

/**
 * Cómo se arma una sesión de Study. Todo puro: la base solo entrega
 * candidatas y este archivo decide cuántas de cada tipo caben.
 *
 * Orden de la sesión: vencidas (más atrasadas primero) y luego nuevas.
 * El tamaño es `metaDiaria`. Para que una cola larga no bloquee lo nuevo,
 * hasta NUEVAS_RESERVADAS lugares se guardan para nuevas si aún queda cupo
 * de nuevas hoy.
 */

export const NUEVAS_RESERVADAS = 3;

/**
 * Cuántas veces puede reinsertarse en UNA sesión una tarjeta en aprendizaje.
 *
 * Está en 0 a propósito. Los pasos de 1 y 10 min de SM-2 pedían volver a
 * ver la tarjeta en la misma sesión, y el motor dejó de hacerlo con esta
 * razón escrita en session.ts: "ver la misma tarjeta dos veces en tres
 * minutos es lo que hacía sentir la práctica interminable". El motor ya
 * sabe reinsertar (`maxReinserciones`, probado en check:srs); activarlo es
 * poner aquí 2, y queda pendiente de que lo confirme quien decide.
 */
export const MAX_REINSERCIONES = 0;

/** Una tarjeta reinsertada vuelve entre 3 y 5 tarjetas después. */
export const REINSERCION_MIN = 3;
export const REINSERCION_MAX = 5;

/** Study ignora el filtro de nivel a propósito (ver useSessionStore); el modo limpio sí cuenta. */
export function filtroEstudio(f: ContentFilter): ContentFilter {
  return { modoLimpio: f.modoLimpio, niveles: [1, 2, 3] as Nivel[] };
}

/** Nuevas que todavía caben hoy. */
export function nuevasRestantesHoy(porDia: number, yaHoy: number): number {
  return Math.max(0, porDia - yaHoy);
}

/** Cuántas vencidas pedir: el tamaño menos los lugares reservados a nuevas. */
export function cupoVencidas(size: number, nuevasPosibles: number): number {
  return Math.max(0, size - Math.min(NUEVAS_RESERVADAS, nuevasPosibles));
}

/** Cuántas nuevas entran una vez traídas las vencidas: lo que sobre, sin pasar del cupo de hoy. */
export function cupoNuevas(size: number, vencidasTraidas: number, nuevasPosibles: number): number {
  return Math.max(0, Math.min(nuevasPosibles, size - vencidasTraidas));
}

/**
 * Arma la sesión: pide primero las nuevas que caben hoy (para saber cuántos
 * lugares reservar), luego las vencidas con el cupo que queda, y por último
 * recorta las nuevas a lo que sobra. Recibe cómo traer cada lista, así la
 * usa la store con la base y la prueba con SQLite en memoria.
 */
export async function armarSesion<T>(p: {
  size: number;
  nuevasPorDia: number;
  yaHoy: number;
  traerNuevas: (limite: number) => Promise<T[]>;
  traerVencidas: (limite: number) => Promise<T[]>;
}): Promise<{ due: T[]; fresh: T[] }> {
  const quedan = nuevasRestantesHoy(p.nuevasPorDia, p.yaHoy);
  const candidatas = quedan > 0 ? await p.traerNuevas(quedan) : [];
  const due = await p.traerVencidas(cupoVencidas(p.size, candidatas.length));
  const fresh = candidatas.slice(0, cupoNuevas(p.size, due.length, candidatas.length));
  return { due, fresh };
}

