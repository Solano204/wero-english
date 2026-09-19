import type { UsoModo } from '@/types';

export type ModoId =
  | 'study'
  | 'gramatica'
  | 'colmena'
  | 'pares'
  | 'caida'
  | 'dulces'
  | 'cazala'
  | 'pares_minimos'
  | 'oido'
  | 'sonidos'
  | 'suena'
  | 'phrasal'
  | 'azar'
  | 'lecturas'
  | 'errores'
  | 'atoran'
  | 'mazo';

/** El orden que tenía Practicar. Desempata los destacados y elige el modo de un usuario nuevo. */
export const ORDEN: readonly ModoId[] = [
  'study', 'gramatica', 'colmena', 'pares', 'caida', 'dulces', 'cazala',
  'pares_minimos', 'oido', 'sonidos', 'suena', 'phrasal', 'azar', 'lecturas',
  'errores', 'atoran', 'mazo',
];

export const NUM_DESTACADOS = 3;

export type Uso = Partial<Record<ModoId, UsoModo>>;

export type MotivoHoy = 'vencidas' | 'atoradas' | 'ultimo' | 'nuevo';

/**
 * Lo que toca hoy, con lo que la app ya guarda:
 *  1. hay repasos vencidos → Study ("Repasar N frases");
 *  2. si no, hay frases atoradas → "Se me atoran";
 *  3. si no, el último modo que dejó registro;
 *  4. si no hay historial, Study.
 *
 * `vencidas` sale de countDue con la misma definición que usa Study al
 * armar la sesión, así que lo que se ofrece es lo que se sirve.
 */
export function elegirHoy(
  vencidas: number,
  atoradas: number,
  uso: Uso
): { modo: ModoId; motivo: MotivoHoy } {
  if (vencidas > 0) return { modo: 'study', motivo: 'vencidas' };
  if (atoradas > 0) return { modo: 'atoran', motivo: 'atoradas' };
  let ultimo: ModoId | null = null;
  for (const id of ORDEN) {
    const u = uso[id];
    if (u && (ultimo === null || u.ultimo > (uso[ultimo]?.ultimo ?? 0))) ultimo = id;
  }
  return ultimo
    ? { modo: ultimo, motivo: 'ultimo' }
    : { modo: 'study', motivo: 'nuevo' };
}

/** Los más usados (por días de uso); sin datos, los primeros de ORDEN. Nunca el de HOY. */
export function elegirDestacados(uso: Uso, hoy: ModoId, n: number = NUM_DESTACADOS): ModoId[] {
  return ORDEN.filter((id) => id !== hoy)
    .map((id, i) => ({ id, i, dias: uso[id]?.dias ?? 0 }))
    .sort((a, b) => b.dias - a.dias || a.i - b.i)
    .slice(0, n)
    .map((x) => x.id);
}
