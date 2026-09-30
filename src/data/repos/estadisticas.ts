import { getDb } from '@/data/cliente';
import { correr, type Parte } from './lote';
import { buildFilter, consultaProgresoPorMundo } from './cola';
import type { ContentFilter, Stats } from '@/types';

/* ============================================================
   Progreso
   ============================================================ */

/** Las estadísticas en una parte (tarjetas, total del catálogo y progreso en subconsultas). */
export function parteStats(usuarioId: number): Parte<Stats> {
  return {
    sql: `SELECT t.vistas, t.dominadas, t.favoritas, t.atoradas,
                 (SELECT COUNT(*) FROM entrada
                   WHERE is_canonical = 1 AND revisar = 0 AND tipo != 'regla_fonetica') AS total,
                 p.racha, p.racha_max, p.total_respuestas, p.total_aciertos
            FROM (SELECT COUNT(*) AS vistas,
                         SUM(dominada) AS dominadas,
                         SUM(favorito) AS favoritas,
                         SUM(CASE WHEN fallos >= 3 AND dominada = 0 THEN 1 ELSE 0 END) AS atoradas
                    FROM tarjeta WHERE usuario_id = ?) AS t
            LEFT JOIN progreso p ON p.usuario_id = ?`,
    params: [usuarioId, usuarioId],
    columnas: ['vistas', 'dominadas', 'favoritas', 'atoradas', 'total', 'racha', 'racha_max', 'total_respuestas', 'total_aciertos'],
    leer: (filas) => statsDe(filas[0] as FilaStats | undefined),
  };
}

export function getStats(usuarioId: number): Promise<Stats> {
  return correr(parteStats(usuarioId));
}

interface FilaStats {
  vistas: number | null;
  dominadas: number | null;
  favoritas: number | null;
  atoradas: number | null;
  total: number | null;
  racha: number | null;
  racha_max: number | null;
  total_respuestas: number | null;
  total_aciertos: number | null;
}

function statsDe(f: FilaStats | undefined): Stats {
  const respuestas = f?.total_respuestas ?? 0;
  return {
    vistas: f?.vistas ?? 0,
    dominadas: f?.dominadas ?? 0,
    favoritas: f?.favoritas ?? 0,
    atoradas: f?.atoradas ?? 0,
    total: f?.total ?? 0,
    racha: f?.racha ?? 0,
    rachaMax: f?.racha_max ?? 0,
    precision: respuestas > 0 ? (f?.total_aciertos ?? 0) / respuestas : 0,
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
