import { getDb } from './client';
import {
  buildFilter,
  consultaContarVencidas,
  consultaDiagnosticoCola,
  consultaNuevas,
  consultaProgresoPorMundo,
  consultaVencidas,
  paramsUpsertTarjeta,
  SQL_UPSERT_TARJETA,
  type ContentFilter,
} from './cola';
import { toEntry, type EntryRow } from './rows';
import { semillaDe } from './semilla';
import { elegirDistractores, prepararPool, type Candidato } from '@/domain/distractores';
import type { CardState, Entry, Nivel, Registro, Vulgaridad } from '@/types';

/* ============================================================
   Filtros globales

   Todas las consultas de contenido pasan por buildFilter para que
   el Modo Limpio y el filtro de nivel se apliquen en UN solo lugar.
   Si se replican por pantalla, tarde o temprano una se olvida y
   aparece una frase de vulgaridad 2 con el modo limpio encendido.
   ============================================================ */

export type { ContentFilter };

const ENTRY_COLS = 'e.*';

/* ============================================================
   Cola de estudio
   ============================================================ */

export interface QueueRow extends EntryRow {
  repeticiones: number | null;
  intervalo: number | null;
  facilidad: number | null;
  vence_en: number | null;
  ultimo_repaso: number | null;
  fallos: number | null;
  aciertos: number | null;
  dominada: number | null;
  favorito: number | null;
}

export function rowToState(r: QueueRow): CardState {
  return {
    entry_id: r.id,
    repeticiones: r.repeticiones ?? 0,
    intervalo: r.intervalo ?? 0,
    facilidad: r.facilidad ?? 2.5,
    vence_en: r.vence_en ?? 0,
    ultimo_repaso: r.ultimo_repaso,
    fallos: r.fallos ?? 0,
    aciertos: r.aciertos ?? 0,
    dominada: (r.dominada ?? 0) as 0 | 1,
    favorito: (r.favorito ?? 0) as 0 | 1,
  };
}

/**
 * Las tarjetas vencidas (definición en SQL_VENCIDA), las más atrasadas primero.
 */
export async function getDueCards(
  usuarioId: number,
  filter: ContentFilter,
  limit: number,
  now = Date.now()
): Promise<{ entry: Entry; state: CardState }[]> {
  const db = await getDb();
  const q = consultaVencidas(usuarioId, filter, limit, now);
  const rows = await db.getAllAsync<QueueRow>(q.sql, q.params);
  return rows.map((r) => ({ entry: toEntry(r), state: rowToState(r) }));
}

/**
 * Frases sin turno: nunca vistas, o favoritas que nunca se estudiaron. En el orden al azar propio
 * del usuario (su semilla; ver ORDEN_NUEVAS y `ordenDeSemilla`): dos personas no reciben las
 * mismas, y la misma persona recibe siempre el mismo orden.
 */
export async function getNewCards(
  usuarioId: number,
  filter: ContentFilter,
  limit: number
): Promise<{ entry: Entry; state: CardState }[]> {
  const db = await getDb();
  const q = consultaNuevas(usuarioId, await semillaDe(usuarioId), filter, limit);
  const rows = await db.getAllAsync<QueueRow>(q.sql, q.params);
  return rows.map((r) => ({ entry: toEntry(r), state: rowToState(r) }));
}

export async function countDue(
  usuarioId: number,
  filter: ContentFilter,
  now = Date.now()
): Promise<number> {
  const db = await getDb();
  const q = consultaContarVencidas(usuarioId, filter, now);
  const row = await db.getFirstAsync<{ n: number }>(q.sql, q.params);
  return row?.n ?? 0;
}

/** Vencidas, de aprendizaje y fantasma, para la pantalla de Diagnóstico. */
export async function getDiagnosticoCola(
  usuarioId: number,
  filter: ContentFilter,
  now = Date.now()
): Promise<{ vencidas: number; aprendizaje: number; fantasma: number }> {
  const db = await getDb();
  const q = consultaDiagnosticoCola(usuarioId, filter, now);
  const row = await db.getFirstAsync<{ vencidas: number; aprendizaje: number; fantasma: number }>(
    q.sql,
    q.params
  );
  return { vencidas: row?.vencidas ?? 0, aprendizaje: row?.aprendizaje ?? 0, fantasma: row?.fantasma ?? 0 };
}

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
   Actualización del estado SM-2
   ============================================================ */

export async function upsertCardState(
  usuarioId: number,
  s: CardState
): Promise<void> {
  const db = await getDb();
  await db.runAsync(SQL_UPSERT_TARJETA, paramsUpsertTarjeta(usuarioId, s));
}

export async function toggleFavorite(
  usuarioId: number,
  entryId: number
): Promise<boolean> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO tarjeta (usuario_id, entry_id, favorito)
     VALUES (?, ?, 1)
     ON CONFLICT(usuario_id, entry_id)
       DO UPDATE SET favorito = 1 - favorito;`,
    [usuarioId, entryId]
  );
  const row = await db.getFirstAsync<{ favorito: number }>(
    'SELECT favorito FROM tarjeta WHERE usuario_id = ? AND entry_id = ?;',
    [usuarioId, entryId]
  );
  return (row?.favorito ?? 0) === 1;
}

/** ¿Está esta frase guardada en Mi mazo? Solo lectura: no toca `toggleFavorite`. */
export async function isFavorite(
  usuarioId: number,
  entryId: number
): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ favorito: number }>(
    'SELECT favorito FROM tarjeta WHERE usuario_id = ? AND entry_id = ?;',
    [usuarioId, entryId]
  );
  return (row?.favorito ?? 0) === 1;
}

/* ============================================================
   Consultas de exploración
   ============================================================ */

export async function getEntry(id: number): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<EntryRow>(
    'SELECT * FROM entrada WHERE id = ?;',
    [id]
  );
  return row ? toEntry(row) : null;
}

export async function getEntriesByIds(ids: number[]): Promise<Entry[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entrada WHERE id IN (${ids.map(() => '?').join(',')});`,
    ids
  );
  const byId = new Map(rows.map((r) => [r.id, toEntry(r)]));
  return ids.map((i) => byId.get(i)).filter((e): e is Entry => Boolean(e));
}

export async function getPackEntries(
  packId: string,
  filter: ContentFilter
): Promise<Entry[]> {
  const db = await getDb();
  const f = buildFilter({ ...filter, packs: [packId] });
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entrada e WHERE ${f.sql} ORDER BY e.nivel ASC, e.id ASC;`,
    f.args
  );
  return rows.map(toEntry);
}

export async function searchEntries(
  term: string,
  filter: ContentFilter,
  limit = 40
): Promise<Entry[]> {
  const db = await getDb();
  const f = buildFilter(filter);
  const like = `%${term.trim()}%`;
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entrada e
      WHERE ${f.sql}
        AND (e.phrase LIKE ? OR e.spanish_main LIKE ? OR e.spanish LIKE ?)
      ORDER BY e.nivel ASC LIMIT ?;`,
    [...f.args, like, like, like, limit]
  );
  return rows.map(toEntry);
}

/** Entradas para el juego: solo las ya estudiadas al menos una vez. */
export async function getStudiedEntries(
  usuarioId: number,
  filter: ContentFilter,
  limit: number
): Promise<Entry[]> {
  const db = await getDb();
  const f = buildFilter(filter);
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT e.* FROM entrada e
       JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE ${f.sql} AND t.repeticiones >= 1
        AND e.tipo != 'regla_fonetica'
      ORDER BY RANDOM() LIMIT ?;`,
    [usuarioId, ...f.args, limit]
  );
  return rows.map(toEntry);
}

export async function getFavorites(
  usuarioId: number,
  filter: ContentFilter
): Promise<Entry[]> {
  const db = await getDb();
  const f = buildFilter(filter);
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT e.* FROM entrada e
       JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE ${f.sql} AND t.favorito = 1
      ORDER BY t.ultimo_repaso DESC NULLS LAST, e.id ASC;`,
    [usuarioId, ...f.args]
  );
  return rows.map(toEntry);
}

/** Las que más se atoran. Alimenta P-14 y la notificación not_atorada. */
export async function getStuckEntries(
  usuarioId: number,
  minFallos = 3,
  limit = 20
): Promise<{ entry: Entry; fallos: number }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow & { fallos: number }>(
    `SELECT e.*, t.fallos FROM entrada e
       JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE t.fallos >= ? AND t.dominada = 0
      ORDER BY t.fallos DESC LIMIT ?;`,
    [usuarioId, minFallos, limit]
  );
  return rows.map((r) => ({ entry: toEntry(r), fallos: r.fallos }));
}

export async function getReglas(grupo?: string): Promise<Entry[]> {
  const db = await getDb();
  const rows = grupo
    ? await db.getAllAsync<EntryRow>(
        'SELECT * FROM entrada WHERE regla_grupo = ? ORDER BY id ASC;',
        [grupo]
      )
    : await db.getAllAsync<EntryRow>(
        'SELECT * FROM entrada WHERE regla_grupo IS NOT NULL ORDER BY id ASC;'
      );
  return rows.map(toEntry);
}

/** Ejemplos para una unidad de gramática, priorizando nivel bajo. */
export async function getByTiempoVerbal(
  tiempo: string,
  limit = 6
): Promise<Entry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entrada
      WHERE tiempo_verbal = ? AND is_canonical = 1 AND revisar = 0
        AND vulgaridad = 0
      ORDER BY nivel ASC, RANDOM() LIMIT ?;`,
    [tiempo, limit]
  );
  return rows.map(toEntry);
}

/* ============================================================
   Progreso
   ============================================================ */

export interface Stats {
  vistas: number;
  dominadas: number;
  favoritas: number;
  atoradas: number;
  total: number;
  racha: number;
  rachaMax: number;
  precision: number;
}

export async function getStats(usuarioId: number): Promise<Stats> {
  const db = await getDb();

  const t = await db.getFirstAsync<{
    vistas: number;
    dominadas: number;
    favoritas: number;
    atoradas: number;
  }>(
    `SELECT COUNT(*) AS vistas,
            SUM(dominada) AS dominadas,
            SUM(favorito) AS favoritas,
            SUM(CASE WHEN fallos >= 3 AND dominada = 0 THEN 1 ELSE 0 END)
              AS atoradas
       FROM tarjeta WHERE usuario_id = ?;`,
    [usuarioId]
  );

  const total = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM entrada
      WHERE is_canonical = 1 AND revisar = 0 AND tipo != 'regla_fonetica';`
  );

  const p = await db.getFirstAsync<{
    racha: number;
    racha_max: number;
    total_respuestas: number;
    total_aciertos: number;
  }>('SELECT * FROM progreso WHERE usuario_id = ?;', [usuarioId]);

  const respuestas = p?.total_respuestas ?? 0;

  return {
    vistas: t?.vistas ?? 0,
    dominadas: t?.dominadas ?? 0,
    favoritas: t?.favoritas ?? 0,
    atoradas: t?.atoradas ?? 0,
    total: total?.n ?? 0,
    racha: p?.racha ?? 0,
    rachaMax: p?.racha_max ?? 0,
    precision: respuestas > 0 ? (p?.total_aciertos ?? 0) / respuestas : 0,
  };
}

/** Cuenta por mundo, para la pantalla de mundos. */
export async function getWorldCounts(
  usuarioId: number,
  filter: ContentFilter
): Promise<Record<string, { total: number; vistas: number }>> {
  const db = await getDb();
  const f = buildFilter(filter);
  const rows = await db.getAllAsync<{
    mundo: string;
    total: number;
    vistas: number;
  }>(
    `SELECT e.mundo,
            COUNT(*) AS total,
            SUM(CASE WHEN t.entry_id IS NULL THEN 0 ELSE 1 END) AS vistas
       FROM entrada e
       LEFT JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE ${f.sql}
      GROUP BY e.mundo;`,
    [usuarioId, ...f.args]
  );
  const out: Record<string, { total: number; vistas: number }> = {};
  for (const r of rows) out[r.mundo] = { total: r.total, vistas: r.vistas };
  return out;
}

/**
 * Frases y dominadas por mundo bajo el mismo filtro de contenido. Para «Por mundo» en
 * Progreso; `getWorldCounts` cuenta las vistas y `getDominadasPorMundo` no aplica el filtro.
 */
export async function getProgresoPorMundo(
  usuarioId: number,
  filter: ContentFilter
): Promise<Record<string, { total: number; dominadas: number }>> {
  const db = await getDb();
  const q = consultaProgresoPorMundo(usuarioId, filter);
  const rows = await db.getAllAsync<{ mundo: string | null; total: number; dominadas: number }>(q.sql, q.params);
  const out: Record<string, { total: number; dominadas: number }> = {};
  for (const r of rows) if (r.mundo) out[r.mundo] = { total: r.total, dominadas: r.dominadas };
  return out;
}

export async function getPackCounts(
  usuarioId: number,
  filter: ContentFilter
): Promise<Record<string, { total: number; vistas: number; dominadas: number }>> {
  const db = await getDb();
  const f = buildFilter(filter);
  const rows = await db.getAllAsync<{
    pack_final: string;
    total: number;
    vistas: number;
    dominadas: number;
  }>(
    `SELECT e.pack_final,
            COUNT(*) AS total,
            SUM(CASE WHEN t.entry_id IS NULL THEN 0 ELSE 1 END) AS vistas,
            COALESCE(SUM(t.dominada), 0) AS dominadas
       FROM entrada e
       LEFT JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE ${f.sql}
      GROUP BY e.pack_final;`,
    [usuarioId, ...f.args]
  );
  const out: Record<
    string,
    { total: number; vistas: number; dominadas: number }
  > = {};
  for (const r of rows) {
    out[r.pack_final] = {
      total: r.total,
      vistas: r.vistas,
      dominadas: r.dominadas,
    };
  }
  return out;
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

/** El estado SM-2 de una entrada, o null si nunca se ha visto. */
export async function getCardState(
  usuarioId: number,
  entryId: number
): Promise<CardState | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    repeticiones: number;
    intervalo: number;
    facilidad: number;
    vence_en: number;
    ultimo_repaso: number | null;
    fallos: number;
    aciertos: number;
    dominada: number;
    favorito: number;
  }>('SELECT * FROM tarjeta WHERE usuario_id = ? AND entry_id = ?;', [
    usuarioId,
    entryId,
  ]);

  if (!row) return null;

  return {
    entry_id: entryId,
    repeticiones: row.repeticiones,
    intervalo: row.intervalo,
    facilidad: row.facilidad,
    vence_en: row.vence_en,
    ultimo_repaso: row.ultimo_repaso,
    fallos: row.fallos,
    aciertos: row.aciertos,
    dominada: row.dominada as 0 | 1,
    favorito: row.favorito as 0 | 1,
  };
}



/** Cuántas frases domina el usuario en cada mundo. Abre las lecturas. */
export async function getDominadasPorMundo(
  usuarioId: number
): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ mundo: string; n: number }>(
    `SELECT e.mundo, COUNT(*) AS n
       FROM entrada e
       JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE t.dominada = 1
      GROUP BY e.mundo;`,
    [usuarioId]
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.mundo] = r.n;
  return out;
}

/** Los estados SM-2 de un puñado de entradas. Lo usa el lector. */
export async function getCardStates(
  usuarioId: number,
  ids: number[]
): Promise<Map<number, CardState>> {
  const out = new Map<number, CardState>();
  if (ids.length === 0) return out;

  const db = await getDb();
  const rows = await db.getAllAsync<{
    entry_id: number;
    repeticiones: number;
    intervalo: number;
    facilidad: number;
    vence_en: number;
    ultimo_repaso: number | null;
    fallos: number;
    aciertos: number;
    dominada: number;
    favorito: number;
  }>(
    `SELECT * FROM tarjeta
      WHERE usuario_id = ? AND entry_id IN (${ids.map(() => '?').join(',')});`,
    [usuarioId, ...ids]
  );

  for (const r of rows) {
    out.set(r.entry_id, {
      entry_id: r.entry_id,
      repeticiones: r.repeticiones,
      intervalo: r.intervalo,
      facilidad: r.facilidad,
      vence_en: r.vence_en,
      ultimo_repaso: r.ultimo_repaso,
      fallos: r.fallos,
      aciertos: r.aciertos,
      dominada: r.dominada as 0 | 1,
      favorito: r.favorito as 0 | 1,
    });
  }
  return out;
}

/* ============================================================
   Bolsas para los juegos

   Los juegos NO dependen de que el usuario ya haya estudiado. Antes sí,
   y el resultado era que alguien recién instalado abría Pares y se
   encontraba una pantalla vacía diciéndole que fuera a estudiar. Un
   juego al que no puedes entrar hasta cumplir una tarea deja de ser el
   plan B del día flojo, que es justo para lo que existe.

   Se ordena al azar. Si la entrada ya tiene tarjeta, la partida igual
   escribe su calificación SM-2, así que jugar sigue adelantando el
   repaso; solo dejó de ser un requisito.
   ============================================================ */

export async function getRandomEntries(
  filter: ContentFilter,
  limit: number,
  opciones: { maxWords?: number; maxLen?: number; conAudio?: boolean } = {}
): Promise<Entry[]> {
  const db = await getDb();
  const f = buildFilter(filter);

  const extra: string[] = [];
  const args: (string | number)[] = [...f.args];

  if (opciones.maxWords !== undefined) {
    extra.push('e.word_count <= ?');
    args.push(opciones.maxWords);
  }
  if (opciones.maxLen !== undefined) {
    extra.push('LENGTH(e.spanish_main) <= ?');
    args.push(opciones.maxLen);
  }
  if (opciones.conAudio) {
    extra.push("e.audio_en IS NOT NULL AND e.audio_en != ''");
  }

  const cond = extra.length > 0 ? ` AND ${extra.join(' AND ')}` : '';
  args.push(limit);

  const rows = await db.getAllAsync<EntryRow>(
    `SELECT e.* FROM entrada e
      WHERE ${f.sql} AND e.tipo != 'regla_fonetica'${cond}
      ORDER BY RANDOM() LIMIT ?;`,
    args
  );
  return rows.map(toEntry);
}

/** Entradas con palabra para deletrear, sin exigir haberlas estudiado. */
export async function getRandomSpellable(
  filter: ContentFilter,
  limit: number
): Promise<Entry[]> {
  const db = await getDb();
  const f = buildFilter(filter);
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT e.* FROM entrada e
      WHERE ${f.sql} AND e.tipo != 'regla_fonetica'
        AND e.word_count BETWEEN 2 AND 6
        AND LENGTH(e.phrase_tts) <= 34
      ORDER BY RANDOM() LIMIT ?;`,
    [...f.args, limit]
  );
  return rows.map(toEntry);
}

