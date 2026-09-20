/**
 * Plantillas de notificación con tokens con nombre, uno por dato.
 *
 * Todo puro: notifications.ts resuelve los datos que la plantilla pide y
 * aquí se rellena. Así se prueba en Node (scripts/check-srs.mjs) sin Expo.
 */

/** Los únicos tokens que existen. `faltan`, `titulo` y `lo_que_dices` aún no tienen fuente de datos. */
export const TOKENS = ['phrase', 'vencidas', 'racha', 'dominadas', 'faltan', 'titulo', 'lo_que_dices'] as const;
export type Token = (typeof TOKENS)[number];

const NUMERICOS: readonly Token[] = ['vencidas', 'racha', 'dominadas', 'faltan'];

export type Valores = Partial<Record<Token, string | number | null>>;

const PATRON = /\{([a-z_]+)\}/g;

/** Los nombres de token que trae el texto, sin repetir. */
export function tokensDe(texto: string): string[] {
  return [...new Set([...texto.matchAll(PATRON)].map((m) => m[1] ?? ''))];
}

/** Tokens del texto que no están en el vocabulario: una plantilla con alguno es un error. */
export function tokensDesconocidos(texto: string): string[] {
  return tokensDe(texto).filter((t) => !(TOKENS as readonly string[]).includes(t));
}

/**
 * Rellena el texto. Devuelve null si falta un dato (un número en cero o sin
 * valor, un texto vacío): una notificación con un hueco es peor que ninguna.
 * Lanza si el texto trae un token que no existe.
 */
export function rellena(texto: string, valores: Valores): string | null {
  const malos = tokensDesconocidos(texto);
  if (malos.length > 0) throw new Error(`Token desconocido {${malos.join('}, {')}} en "${texto}"`);

  let falta = false;
  const out = texto.replace(PATRON, (_, nombre: Token) => {
    const v = valores[nombre];
    if (NUMERICOS.includes(nombre)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) falta = true;
      return String(v);
    }
    if (typeof v !== 'string' || v.trim() === '') falta = true;
    return String(v);
  });
  return falta ? null : out;
}
