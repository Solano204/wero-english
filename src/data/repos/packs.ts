import { getDb } from '@/data/cliente';

/** La tabla `pack_estado`: qué packs de medios descargó cada usuario (la descarga vive en services/descargas.ts). */

export async function estaDescargado(usuarioId: number, packId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ descargado: number }>(
    'SELECT descargado FROM pack_estado WHERE usuario_id = ? AND pack_id = ?;',
    [usuarioId, packId]
  );
  return (row?.descargado ?? 0) === 1;
}

export async function marcarDescargado(
  usuarioId: number,
  packId: string,
  bytes: number,
  version: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pack_estado (usuario_id, pack_id, descargado, activo, bytes, version)
     VALUES (?,?,1,1,?,?)
     ON CONFLICT(usuario_id, pack_id) DO UPDATE SET
       descargado = 1, activo = 1, bytes = excluded.bytes,
       version = excluded.version;`,
    [usuarioId, packId, bytes, version]
  );
}

export async function marcarNoDescargado(usuarioId: number, packId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE pack_estado SET descargado = 0, bytes = 0
       WHERE usuario_id = ? AND pack_id = ?;`,
    [usuarioId, packId]
  );
}
