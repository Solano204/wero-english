import { getDb } from '@/data/cliente';

/**
 * El SQL de los borrados de Ajustes › Legal (la orquestación vive en services/cuenta/borrado.ts).
 *
 * Qué tablas son "del usuario" no está escrito a mano: se buscan en la base todas las que tienen
 * una columna `usuario_id`, así una tabla nueva nunca se queda fuera de un borrado.
 */

async function tablasDelUsuario(): Promise<string[]> {
  const db = await getDb();
  const tablas = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`
  );
  const conUsuario: string[] = [];
  for (const { name } of tablas) {
    // El nombre sale de sqlite_master, no de la persona: no hay nada que inyectar.
    const columnas = await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${name}");`);
    if (columnas.some((c) => c.name === 'usuario_id')) conUsuario.push(name);
  }
  return conUsuario;
}

/**
 * Los packs que esta persona descargó y nadie más en el teléfono tiene: sus archivos se pueden
 * borrar. Los que otro perfil también bajó se quedan (son contenido de la app, no de la persona).
 */
export async function packsSoloSuyos(usuarioId: number): Promise<string[]> {
  const db = await getDb();
  const filas = await db.getAllAsync<{ pack_id: string }>(
    `SELECT pack_id FROM pack_estado p
      WHERE p.usuario_id = ? AND p.descargado = 1
        AND NOT EXISTS (
          SELECT 1 FROM pack_estado o
           WHERE o.pack_id = p.pack_id AND o.usuario_id != p.usuario_id AND o.descargado = 1
        );`,
    [usuarioId]
  );
  return filas.map((f) => f.pack_id);
}

/** Borra, en una transacción, las filas del usuario en todas las tablas que cuelgan de él. */
export async function vaciarTablasDelUsuario(usuarioId: number): Promise<void> {
  const tablas = await tablasDelUsuario();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const tabla of tablas) {
      await db.runAsync(`DELETE FROM "${tabla}" WHERE usuario_id = ?;`, [usuarioId]);
    }
  });
}
