import { getDb } from '@/data/cliente';
import { elegirDistractores, prepararPool, type Candidato } from '@/domain/distractores';
import type { Entry } from '@/types';

/* ============================================================
   Distractores del ejercicio Reconocer

   La elección vive en domain/distractores.ts. Ahí se cuida que la
   larga no se distinga de las cortas (el problema clásico: si la
   correcta es larga y las tres falsas cortas, se acierta sin leer), que
   un número, un nombre propio o un cognado no delate la correcta, que
   ninguna falsa sea la misma traducción y que no se repitan en la
   sesión. Aquí solo se lee el catálogo, una vez por arranque de la app:
   son ~1,500 filas de texto y elegir sobre ellas en memoria es más
   barato que una consulta con ORDER BY RANDOM() por tarjeta.
   ============================================================ */

let poolDistractores: Promise<Candidato[]> | null = null;

function cargarPoolDistractores(): Promise<Candidato[]> {
  if (!poolDistractores) {
    poolDistractores = (async () => {
      const db = await getDb();
      const filas = await db.getAllAsync<{
        id: number;
        phrase: string;
        spanish_main: string;
        word_count: number;
        pack_final: string;
        mundo: string;
      }>(
        `SELECT id, phrase, spanish_main, word_count, pack_final, mundo FROM entrada
          WHERE is_canonical = 1 AND revisar = 0;`
      );
      return prepararPool(
        filas.map((f) => ({
          id: f.id,
          phrase: f.phrase,
          spanish: f.spanish_main,
          wordCount: f.word_count,
          pack: f.pack_final,
          mundo: f.mundo,
        }))
      );
    })().catch((err) => {
      // Si la lectura falla, la próxima tarjeta vuelve a intentarlo en vez de quedarse con el fallo.
      poolDistractores = null;
      throw err;
    });
  }
  return poolDistractores;
}

/**
 * Arma el pool de distractores en un momento tranquilo (poco después de entrar), para que la
 * primera tarjeta de Estudiar no pague leer y preparar ~1,500 frases justo mientras entra la
 * pantalla. Si falla, la primera tarjeta lo vuelve a intentar como siempre.
 */
export function precargarDistractores(): void {
  cargarPoolDistractores().catch(() => undefined);
}

/**
 * Las opciones falsas de una tarjeta. `usados` son las que ya salieron en tarjetas anteriores de la sesión: no se
 * repiten mientras haya otras disponibles.
 */
export async function getDistractors(
  entry: Entry,
  count = 3,
  usados: ReadonlySet<string> = new Set()
): Promise<string[]> {
  const pool = await cargarPoolDistractores();
  return elegirDistractores(
    {
      id: entry.id,
      phrase: entry.phrase,
      spanish: entry.spanish_main,
      wordCount: entry.word_count,
      pack: entry.pack_final,
      mundo: entry.mundo,
    },
    pool,
    count,
    usados
  );
}

/* ============================================================
   Señuelos de palabra para el ejercicio Construir

   Los distractores de Reconocer son significados en español; estos son
   palabras sueltas en inglés. Se sacan de frases del mismo pack porque
   un señuelo obviamente ajeno al tema convierte el ejercicio en leer la
   fila de fichas en vez de recordar la frase.
   ============================================================ */

export async function getWordDecoys(
  entry: Entry,
  count = 3
): Promise<string[]> {
  const db = await getDb();

  const rows = await db.getAllAsync<{ phrase_tts: string }>(
    `SELECT phrase_tts FROM entrada
      WHERE pack_final = ? AND id != ?
        AND is_canonical = 1 AND revisar = 0
        AND word_count BETWEEN 2 AND 12
      ORDER BY RANDOM() LIMIT 14;`,
    [entry.pack_final, entry.id]
  );

  const propias = new Set(splitWords(entry.phrase_tts).map((w) => w.toLowerCase()));
  const vistos = new Set<string>();
  const out: string[] = [];

  for (const r of rows) {
    for (const w of splitWords(r.phrase_tts)) {
      const key = w.toLowerCase();
      if (propias.has(key) || vistos.has(key)) continue;
      // Un señuelo de una letra no engaña a nadie y estorba en pantalla.
      if (w.length < 2) continue;
      vistos.add(key);
      out.push(w);
      if (out.length >= count) return out;
    }
  }

  return out;
}

/** Parte una frase en palabras conservando apóstrofos internos. */
export function splitWords(phrase: string): string[] {
  return phrase
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ''))
    .filter((w) => w.length > 0);
}


/**
 * Los distractores de Reconocer y los señuelos de Construir de toda una sesión, de una vez: una consulta por
 * tarjeta en medio de la sesión mete un salto perceptible entre tarjetas.
 */
export async function precargarOpcionesSesion(
  all: { entry: Entry }[]
): Promise<{ distractorMap: Map<number, string[]>; wordMap: Map<number, string[]> }> {
  // Los distractores se precargan de golpe: una consulta por tarjeta
  // en medio de la sesión mete un salto perceptible entre tarjetas.
  const distractorMap = new Map<number, string[]>();
  const wordMap = new Map<number, string[]>();

  // Se eligen una tarjeta tras otra con la lista de los que ya salieron en
  // esta sesión: dos tarjetas no comparten opciones falsas mientras haya
  // otras disponibles. Cada elección es barata (el catálogo va en memoria),
  // pero cada 8 se cede el hilo para que la pantalla de carga siga fluida.
  const distractoresUsados = new Set<string>();
  for (let i = 0; i < all.length; i++) {
    const c = all[i];
    if (!c) continue;
    const falsos = await getDistractors(c.entry, 3, distractoresUsados);
    distractorMap.set(c.entry.id, falsos);
    for (const f of falsos) distractoresUsados.add(f);
    if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
  }

  // Los señuelos de palabra solo hacen falta si la frase es lo bastante
  // larga para que Construir aparezca. Pedirlos para todas duplicaría las
  // consultas del arranque sin necesidad.
  await Promise.all(
    all
      .filter((c) => c.entry.word_count >= 3)
      .map(async (c) => {
        wordMap.set(c.entry.id, await getWordDecoys(c.entry, 3));
      })
  );

  return { distractorMap, wordMap };
}
