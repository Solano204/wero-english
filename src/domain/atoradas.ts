/**
 * Lo puro de Se me atoran: el medidor de atasco (cuántos puntos, qué texto), qué tarjetas van más grandes, en qué orden y
 * cuáles se desatoraron desde la última visita. No importa nada: se prueba con `npm run check:atoradas`. Qué cuenta como
 * atorada (3 fallos o más y no dominada) lo decide `getStuckEntries`; `sigueAtorada` repite ese mismo criterio para
 * preguntar por una frase suelta.
 */

/** Cuántos puntos tiene el medidor: se encienden tantos como fallos haya, con este tope. */
export const PUNTOS_ATASCO = 5;

/** Cuántos puntos del medidor se encienden con `fallos`. */
export function puntosEncendidos(fallos: number): number {
  return Math.min(PUNTOS_ATASCO, Math.max(0, Math.floor(fallos)));
}

/** «1 fallo», «4 fallos»: el número real, aunque pase del tope de puntos («7 fallos»). */
export function etiquetaFallos(fallos: number): string {
  const n = Math.max(0, Math.floor(fallos));
  return `${n} ${n === 1 ? 'fallo' : 'fallos'}`;
}

export type TamanoAtorada = 'normal' | 'grande';

/** Las que llenan el medidor (5 fallos o más) van levemente más grandes: no todas las tarjetas iguales (IA-2). */
export function tamanoAtorada(fallos: number): TamanoAtorada {
  return fallos >= PUNTOS_ATASCO ? 'grande' : 'normal';
}

/** Las que tienen más fallos arriba; a igual número, por id, para que el orden no baile entre visitas. No modifica la lista. */
export function ordenarAtoradas<T extends { entry: { id: number }; fallos: number }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => b.fallos - a.fallos || a.entry.id - b.entry.id);
}

/** Cuántos fallos hacen atorada a una frase: el mismo umbral de `getStuckEntries`. */
export const MIN_FALLOS = 3;

/** ¿Sigue atorada? El mismo criterio de `getStuckEntries`: 3 fallos o más y no dominada. */
export function sigueAtorada(estado: { fallos: number; dominada: number }): boolean {
  return estado.fallos >= MIN_FALLOS && !estado.dominada;
}

/** Lo que se guarda de una atorada en la última visita: qué frase era y con cuántos fallos, para poder apagar sus puntos. */
export interface AtoradaVista {
  id: number;
  fallos: number;
}

/** Cuántas frases desatoradas se muestran a la vez: más que eso cansa y no es lo que se vino a ver. */
export const MAX_DESATORADAS = 3;

/** Lo guardado en ajustes, con lo que no sirva descartado (un ajuste corrupto no tumba la pantalla). Sin repetidas. */
export function normalizarVistas(valor: unknown): AtoradaVista[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<number>();
  const out: AtoradaVista[] = [];
  for (const v of valor) {
    if (typeof v !== 'object' || v === null) continue;
    const { id, fallos } = v as Record<string, unknown>;
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || vistos.has(id)) continue;
    if (typeof fallos !== 'number' || !Number.isInteger(fallos) || fallos < 0) continue;
    vistos.add(id);
    out.push({ id, fallos });
  }
  return out;
}

/** Lo que se guarda al terminar de cargar la lista: las que están atoradas ahora. */
export function vistasDe(lista: readonly { entry: { id: number }; fallos: number }[]): AtoradaVista[] {
  return lista.map((a) => ({ id: a.entry.id, fallos: a.fallos }));
}

/** ¿Es lo mismo? Sin importar el orden: si lo es, no hay nada que volver a guardar. */
export function mismasVistas(a: readonly AtoradaVista[], b: readonly AtoradaVista[]): boolean {
  if (a.length !== b.length) return false;
  const fallosDe = new Map(a.map((v) => [v.id, v.fallos]));
  return b.every((v) => fallosDe.get(v.id) === v.fallos);
}

/** Las de la última visita que ya no están entre las atoradas de ahora: hay que preguntarle a la base si de verdad se destrabaron. */
export function candidatasDestrabadas(previas: readonly AtoradaVista[], actuales: readonly number[]): AtoradaVista[] {
  const ahora = new Set(actuales);
  return previas.filter((p) => !ahora.has(p.id));
}

/**
 * Las que se desatoraron desde la última visita: de las candidatas, las que la base dice que ya no están atoradas
 * (quedaron dominadas). Una que solo salió de la lista por el tope de 30 sigue atorada y no cuenta. Las que más fallos
 * tenían primero, hasta `MAX_DESATORADAS`.
 */
export function destrabadas(
  candidatas: readonly AtoradaVista[],
  estados: ReadonlyMap<number, { fallos: number; dominada: number }>
): AtoradaVista[] {
  return candidatas
    .filter((c) => {
      const e = estados.get(c.id);
      return e !== undefined && !sigueAtorada(e);
    })
    .sort((a, b) => b.fallos - a.fallos || a.id - b.id)
    .slice(0, MAX_DESATORADAS);
}

/** Los tiempos de «desatorar» una tarjeta (ms). Los pone `motion.ts`; aquí llegan por parámetro para poder probarlos. */
export interface TiemposDesatorar {
  entra: number;
  /** Lo que tarda en apagarse cada punto. */
  punto: number;
  /** Lo que se queda la etiqueta a la vista, con el destello, antes de que la tarjeta se vaya. */
  pausa: number;
  sale: number;
}

/** Cuánto dura desatorar una tarjeta con `puntos` encendidos, de que entra a que termina de irse. */
export function duracionDesatorar(puntos: number, t: TiemposDesatorar): number {
  return t.entra + Math.min(PUNTOS_ATASCO, Math.max(0, puntos)) * t.punto + t.pausa + t.sale;
}
