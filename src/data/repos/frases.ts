import { getDb } from '@/data/cliente';
import { buildFilter } from './cola';
import { toEntry, type EntryRow } from '@/data/filas';
import type { ContentFilter, Entry } from '@/types';

/* ============================================================
   Filtros globales

   Todas las consultas de contenido pasan por buildFilter para que
   el Modo Limpio y el filtro de nivel se apliquen en UN solo lugar.
   Si se replican por pantalla, tarde o temprano una se olvida y
   aparece una frase de vulgaridad 2 con el modo limpio encendido.
   ============================================================ */

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
