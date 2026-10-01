/**
 * Felicitaciones. Cortas, sin exclamaciones y sin promesas: dicen lo que
 * pasó, no lo bien que lo hiciste. Cada pool se recorre al azar sin repetir
 * la que salió justo antes.
 */

/** Al acertar una tarjeta. El dato concreto (cuándo vuelve la frase) va al lado. */
export const ACIERTO = [
  'Exacto',
  'Así es',
  'Eso es',
  'Justo esa',
  'Bien visto',
  'Correcto',
  'Le diste',
  'Sí, esa',
] as const;

/** Partida sin un solo error. `{n}` es el número de rondas. */
export const PARTIDA_PERFECTA = [
  'Todas. Sin fallar una.',
  '{n} de {n}, sin un error.',
  'Ronda limpia: {n} de {n}.',
  'Cero errores.',
  'Todas bien.',
  'Sin un solo fallo.',
] as const;

/** Nivel con las tres estrellas. */
export const TRES_ESTRELLAS = [
  'Las tres estrellas.',
  'Tres de tres.',
  'Nivel completo con las tres.',
  'Ya no queda estrella por sacar aquí.',
  'Estrellas completas.',
  'Nivel cerrado con tres estrellas.',
] as const;

const ultima = new WeakMap<readonly string[], string>();

/** Una frase del pool al azar, distinta de la anterior que salió de ese mismo pool. */
export function elegirFrase(pool: readonly string[]): string {
  const previa = ultima.get(pool);
  const opciones = pool.length > 1 ? pool.filter((f) => f !== previa) : pool;
  const frase = opciones[Math.floor(Math.random() * opciones.length)] ?? pool[0] ?? '';
  ultima.set(pool, frase);
  return frase;
}
