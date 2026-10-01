import { getDb } from '@/data/cliente';

/** Lo que las notificaciones leen y registran en la base (las reglas viven en services/notificaciones.ts). */

export async function contarDominadas(usuarioId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM tarjeta WHERE usuario_id = ? AND dominada = 1;',
    [usuarioId]
  );
  return row?.n ?? 0;
}

/** Una frase ya vista, de vulgaridad `maxVulgaridad` o menos. */
export async function fraseSegura(usuarioId: number, maxVulgaridad: number): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ phrase: string }>(
    `SELECT e.phrase FROM entrada e
       JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE e.vulgaridad <= ? AND e.is_canonical = 1 AND e.revisar = 0
        AND t.repeticiones >= 1
      ORDER BY RANDOM() LIMIT 1;`,
    [usuarioId, maxVulgaridad]
  );
  return row?.phrase ?? null;
}

export async function plantillasRecientes(
  usuarioId: number,
  dias: number
): Promise<Set<string>> {
  const db = await getDb();
  const desde = Date.now() - dias * 86_400_000;
  const rows = await db.getAllAsync<{ plantilla: string }>(
    'SELECT DISTINCT plantilla FROM notif_log WHERE usuario_id = ? AND enviado_en >= ?;',
    [usuarioId, desde]
  );
  return new Set(rows.map((r) => r.plantilla));
}

export async function registrarNotificacion(
  usuarioId: number,
  plantilla: string,
  entryId: number | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO notif_log (usuario_id, plantilla, entry_id, enviado_en) VALUES (?,?,?,?);',
    [usuarioId, plantilla, entryId, Date.now()]
  );
}
