/**
 * Lo puro de Mi mazo: cuándo un deslizamiento cuenta como «Quitar» y cómo se quita una frase de la lista y se regresa a
 * su lugar al deshacer. No importa nada: se prueba con `npm run check:atoradas`. Lo que corre en el hilo de UI (el gesto y
 * los estilos animados) lleva 'worklet'.
 */

/** Lo que cuenta un deslizamiento a la izquierda (dp y dp/s). */
export const QUITAR = {
  distancia: 96,
  velocidad: 800,
  /** Hacia la derecha la tarjeta no puede ir: solo cede esta fracción de lo que se arrastra. */
  resistencia: 0.25,
  /** Lo que hay que mover el dedo de lado para que sea un deslizamiento (y no el scroll de la lista). */
  activa: 12,
  /** Lo que se puede mover en vertical antes de que el gesto ceda ante el scroll. */
  falla: 10,
} as const;

export type GestoQuitar = 'quitar' | 'volver';

/** Qué hacer al soltar: pasa por distancia (96 dp) o por velocidad (800 dp/s), lo que llegue primero; si no, regresa. */
export function decidirQuitar(dx: number, vx: number): GestoQuitar {
  'worklet';
  return -dx >= QUITAR.distancia || -vx >= QUITAR.velocidad ? 'quitar' : 'volver';
}

/** Qué tan cerca está «Quitar» mientras se arrastra: de 0 a 1 (1 en el umbral). */
export function avanceQuitar(dx: number): number {
  'worklet';
  return dx >= 0 ? 0 : Math.min(1, -dx / QUITAR.distancia);
}

/** Hacia la derecha la tarjeta solo cede una fracción de lo arrastrado. */
export function amortiguarQuitar(dx: number): number {
  'worklet';
  return dx < 0 ? dx : dx * QUITAR.resistencia;
}

/** La lista sin el elemento `id`, dónde estaba y el elemento. No modifica la lista que recibe; si no está, la devuelve igual. */
export function quitarDeLista<T extends { id: number }>(
  lista: readonly T[],
  id: number
): { lista: T[]; indice: number; elemento: T | null } {
  const indice = lista.findIndex((e) => e.id === id);
  if (indice < 0) return { lista: [...lista], indice: -1, elemento: null };
  return { lista: [...lista.slice(0, indice), ...lista.slice(indice + 1)], indice, elemento: lista[indice] ?? null };
}

/** Regresa el elemento a su lugar (o al final si la lista ya es más corta). Si ya está, no lo duplica. */
export function reinsertar<T extends { id: number }>(lista: readonly T[], elemento: T, indice: number): T[] {
  if (lista.some((e) => e.id === elemento.id)) return [...lista];
  const lugar = Math.max(0, Math.min(indice, lista.length));
  return [...lista.slice(0, lugar), elemento, ...lista.slice(lugar)];
}
