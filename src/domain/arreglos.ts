/** Fisher-Yates. Devuelve un array nuevo, no muta el original. */
export function shuffle<T>(input: readonly T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const ai = a[i] as T;
    const aj = a[j] as T;
    a[i] = aj;
    a[j] = ai;
  }
  return a;
}

export function pickRandom<T>(input: readonly T[]): T | undefined {
  if (input.length === 0) return undefined;
  return input[Math.floor(Math.random() * input.length)];
}

/** Elige n elementos distintos al azar. */
export function sample<T>(input: readonly T[], n: number): T[] {
  return shuffle(input).slice(0, n);
}

/**
 * Elige uno según pesos. Si todos los pesos son 0 devuelve el primero.
 * Lo usa el selector de plantilla de notificación.
 */
export function weightedPick<T>(
  items: readonly T[],
  weight: (item: T) => number
): T | undefined {
  if (items.length === 0) return undefined;
  const total = items.reduce((s, i) => s + Math.max(0, weight(i)), 0);
  if (total <= 0) return items[0];
  let r = Math.random() * total;
  for (const item of items) {
    r -= Math.max(0, weight(item));
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

export function unique<T>(input: readonly T[]): T[] {
  return [...new Set(input)];
}

/** Parte un array en trozos de tamaño n. */
export function chunk<T>(input: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < input.length; i += n) {
    out.push(input.slice(i, i + n) as T[]);
  }
  return out;
}
