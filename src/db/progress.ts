import { getDb } from './client';
import { consultaNuevasHoy } from './cola';
import { dayKey, daysBetween } from '@/utils/date';

export interface DayRecord {
  dia: string;
  respuestas: number;
  aciertos: number;
}

/** Crea la fila de progreso si no existe. Se llama al crear la cuenta. */
export async function initProgress(usuarioId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO progreso (usuario_id) VALUES (?);',
    [usuarioId]
  );
}

/**
 * Registra que hubo actividad hoy y devuelve la racha resultante.
 *
 * La regla del mockup: perder la racha no cuesta nada. Si el usuario
 * falta un día, la racha vuelve a 1 y no se le menciona jamás.
 */
export async function touchStreak(
  usuarioId: number,
  now = Date.now()
): Promise<{ racha: number; esNuevoDia: boolean }> {
  const db = await getDb();
  const hoy = dayKey(now);

  const row = await db.getFirstAsync<{
    racha: number;
    racha_max: number;
    ultimo_dia: string | null;
  }>('SELECT racha, racha_max, ultimo_dia FROM progreso WHERE usuario_id = ?;',
    [usuarioId]
  );

  if (!row) {
    await initProgress(usuarioId);
    await db.runAsync(
      'UPDATE progreso SET racha = 1, racha_max = 1, ultimo_dia = ? WHERE usuario_id = ?;',
      [hoy, usuarioId]
    );
    return { racha: 1, esNuevoDia: true };
  }

  if (row.ultimo_dia === hoy) {
    return { racha: row.racha, esNuevoDia: false };
  }

  const gap = row.ultimo_dia ? daysBetween(row.ultimo_dia, hoy) : 999;
  const racha = gap === 1 ? row.racha + 1 : 1;
  const max = Math.max(racha, row.racha_max);

  await db.runAsync(
    'UPDATE progreso SET racha = ?, racha_max = ?, ultimo_dia = ? WHERE usuario_id = ?;',
    [racha, max, hoy, usuarioId]
  );

  return { racha, esNuevoDia: true };
}

export async function startSession(
  usuarioId: number,
  now = Date.now()
): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO sesion (usuario_id, dia, inicio) VALUES (?,?,?);',
    [usuarioId, dayKey(now), now]
  );
  return res.lastInsertRowId;
}

export async function endSession(
  sesionId: number,
  usuarioId: number,
  data: { respuestas: number; aciertos: number; nuevas: number },
  now = Date.now()
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE sesion SET fin = ?, respuestas = ?, aciertos = ?, nuevas = ?
         WHERE id = ?;`,
      [now, data.respuestas, data.aciertos, data.nuevas, sesionId]
    );
    await db.runAsync(
      `UPDATE progreso SET
         total_sesiones   = total_sesiones + 1,
         total_respuestas = total_respuestas + ?,
         total_aciertos   = total_aciertos + ?
       WHERE usuario_id = ?;`,
      [data.respuestas, data.aciertos, usuarioId]
    );
  });
}

/** Cuántas frases nuevas entraron hoy (hora local) por sesiones de estudio. */
export async function getNuevasHoy(usuarioId: number, now = Date.now()): Promise<number> {
  const db = await getDb();
  const q = consultaNuevasHoy(usuarioId, now);
  const row = await db.getFirstAsync<{ n: number }>(q.sql, q.params);
  return row?.n ?? 0;
}

/** Los últimos N días con actividad. Alimenta la gráfica de P-13. */
export async function getRecentDays(
  usuarioId: number,
  days = 30
): Promise<DayRecord[]> {
  const db = await getDb();
  return db.getAllAsync<DayRecord>(
    `SELECT dia, SUM(respuestas) AS respuestas, SUM(aciertos) AS aciertos
       FROM sesion WHERE usuario_id = ?
      GROUP BY dia ORDER BY dia DESC LIMIT ?;`,
    [usuarioId, days]
  );
}

export async function getLastActive(
  usuarioId: number
): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ ultimo_dia: string | null }>(
    'SELECT ultimo_dia FROM progreso WHERE usuario_id = ?;',
    [usuarioId]
  );
  return row?.ultimo_dia ?? null;
}
