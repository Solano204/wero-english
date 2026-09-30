import { getDb } from '@/data/cliente';
import { buildFilter, consultaContarVencidas, consultaDiagnosticoCola, consultaNuevas, consultaContarNuevas, consultaProximoRepaso, semillaDeSesion, consultaVencidas, paramsUpsertTarjeta, SQL_UPSERT_TARJETA } from './cola';
import { toEntry, type EntryRow } from '@/data/filas';
import { semillaDe } from '@/data/semilla/semillaAleatoria';
import type { CardState, ContentFilter, Entry } from '@/types';

/**
 * La cola de estudio y el estado SM-2 de cada tarjeta: qué toca hoy, qué es nuevo y cómo se guarda cada repaso.
 * El filtro de contenido (modo limpio, nivel, pack y mundo) se aplica siempre con buildFilter, en un solo lugar.
 */

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
 * Frases sin turno: nunca vistas, o favoritas que nunca se estudiaron, en orden al azar (ver
 * ORDEN_NUEVAS y `ordenDeSemilla`). Con `sal` (Estudiar) cada sesión sortea otro orden; sin ella,
 * el orden fijo del usuario. Dos personas nunca reciben el mismo.
 */
export async function getNewCards(
  usuarioId: number,
  filter: ContentFilter,
  limit: number,
  /** Una sal al azar por sesión (Estudiar): cada sesión sortea otro orden. Sin ella, el orden fijo del usuario. */
  sal?: number
): Promise<{ entry: Entry; state: CardState }[]> {
  const db = await getDb();
  const semilla = await semillaDe(usuarioId);
  const q = consultaNuevas(usuarioId, sal === undefined ? semilla : semillaDeSesion(semilla, sal), filter, limit);
  const rows = await db.getAllAsync<QueueRow>(q.sql, q.params);
  return rows.map((r) => ({ entry: toEntry(r), state: rowToState(r) }));
}

/** Frases nuevas que quedan en el catálogo con este filtro. */
export async function countNew(usuarioId: number, filter: ContentFilter): Promise<number> {
  const db = await getDb();
  const q = consultaContarNuevas(usuarioId, filter);
  const row = await db.getFirstAsync<{ n: number }>(q.sql, q.params);
  return row?.n ?? 0;
}

/** Cuándo vuelve el próximo repaso (ms epoch), o null si no hay ninguno programado. */
export async function getProximoRepaso(usuarioId: number, filter: ContentFilter, now = Date.now()): Promise<number | null> {
  const db = await getDb();
  const q = consultaProximoRepaso(usuarioId, filter, now);
  const row = await db.getFirstAsync<{ proximo: number | null }>(q.sql, q.params);
  return row?.proximo ?? null;
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
