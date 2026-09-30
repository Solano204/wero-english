import { getDb } from '@/data/cliente';
import type { TipoDesbloqueo } from '@/types';

/**
 * Desbloqueo por anuncio.
 *
 * El trato con el usuario, y conviene tenerlo escrito porque es lo que
 * decide cada detalle de este archivo:
 *
 *   Ves un anuncio UNA vez y esa parte queda abierta PARA SIEMPRE,
 *   también sin internet. No se vuelve a pedir.
 *
 * De ahí salen tres decisiones:
 *
 * 1. Vive en la base local, no en un servidor. Si el desbloqueo
 *    dependiera de la red, quien ya pagó con su atención se volvería a
 *    encontrar el muro en el metro. Eso es cobrar dos veces.
 *
 * 2. Un solo espacio de claves con prefijo, no una tabla por tipo. Si
 *    mañana quieres desbloquear algo nuevo, es una clave nueva y ni una
 *    migración.
 *
 * 3. Nada se prellena. Una fila que no existe es algo sin desbloquear.
 *
 * Lo que NUNCA se pone detrás de un muro: la sesión de frases al azar,
 * el progreso propio y los ajustes. Se cobra por contenido extra, no por
 * usar la app.
 */


/** 'pack' + 'calle_01' -> 'pack:calle_01'. */
export function claveDe(tipo: TipoDesbloqueo, id: string): string {
  return `${tipo}:${id}`;
}

/** Todas las claves abiertas del usuario. Se lee una vez al arrancar. */
export async function getDesbloqueos(usuarioId: number): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ clave: string }>(
    `SELECT clave FROM desbloqueo WHERE usuario_id = ?;`,
    [usuarioId]
  );
  return new Set(rows.map((r) => r.clave));
}

/**
 * Abre una clave. Es idempotente: llamarla dos veces no duplica ni
 * reinicia la fecha, porque lo que importa es que esté abierta, no
 * cuántas veces se abrió.
 */
export async function desbloquear(
  usuarioId: number,
  clave: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO desbloqueo (usuario_id, clave, desbloqueado_en)
     VALUES (?,?,?)
     ON CONFLICT(usuario_id, clave) DO NOTHING;`,
    [usuarioId, clave, Date.now()]
  );
}

export async function estaDesbloqueado(
  usuarioId: number,
  clave: string
): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM desbloqueo WHERE usuario_id = ? AND clave = ?;`,
    [usuarioId, clave]
  );
  return (row?.n ?? 0) > 0;
}

/** Solo para Ajustes → borrar datos. No se usa en el flujo normal. */
export async function borrarDesbloqueos(usuarioId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM desbloqueo WHERE usuario_id = ?;`, [usuarioId]);
}
