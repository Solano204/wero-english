/** Normaliza para comparar respuestas escritas. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distancia de Levenshtein. Se usa para aceptar una respuesta escrita
 * con un typo en vez de castigar al usuario por una letra.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length] ?? 0;
}

/**
 * ¿La respuesta escrita cuenta como correcta?
 * Tolera un error por cada 8 caracteres, mínimo 1. Sin esa tolerancia
 * el ejercicio de escribir se vuelve un examen de ortografía.
 */
export function isCloseEnough(given: string, expected: string): boolean {
  const g = normalizeAnswer(given);
  const e = normalizeAnswer(expected);
  if (g === e) return true;
  if (g.length === 0) return false;
  const budget = Math.max(1, Math.floor(e.length / 8));
  return levenshtein(g, e) <= budget;
}

/** Corta a n caracteres sin partir palabras. */
export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const space = cut.lastIndexOf(' ');
  return (space > n * 0.6 ? cut.slice(0, space) : cut) + '…';
}

/** Reemplaza la palabra objetivo por un hueco, respetando mayúsculas. */
export function blankOut(phrase: string, word: string): string {
  const re = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
  return phrase.replace(re, '______');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Primera letra en mayúscula, el resto igual. */
export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/**
 * La palabra en singular o en plural según la cantidad: `plural(1, 'frase')` da
 * 'frase' y `plural(2, 'frase')` da 'frases'. Para lo irregular se pasa la forma:
 * `plural(2, 'error', 'errores')`.
 */
export function plural(n: number, singular: string, formaPlural: string = `${singular}s`): string {
  return n === 1 ? singular : formaPlural;
}

/** Cantidad y palabra: `conteo(1, 'frase')` da '1 frase'; `conteo(5, 'error', 'errores')` da '5 errores'. */
export function conteo(n: number, singular: string, formaPlural?: string): string {
  return `${n} ${plural(n, singular, formaPlural)}`;
}

/** Miles con coma, como se escribe en México: `miles(1436)` da '1,436'. */
export function miles(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
