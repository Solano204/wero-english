import * as Crypto from 'expo-crypto';
import { getDb } from '@/data/cliente';

/**
 * La semilla de cada usuario: de ella sale el orden propio de sus frases nuevas (ver
 * `ordenDeSemilla` en db/cola.ts). 32 bits al azar de expo-crypto, una vez, al crear el usuario;
 * a los que ya existían se la dio la migración v8.
 */
export function nuevaSemilla(): number {
  const b = Crypto.getRandomBytes(4);
  return ((b[0] ?? 0) * 2 ** 24 + (b[1] ?? 0) * 2 ** 16 + (b[2] ?? 0) * 2 ** 8 + (b[3] ?? 0)) >>> 0;
}

const cache = new Map<number, number>();

/**
 * La semilla del usuario. Si por lo que sea no tiene (una fila creada por código viejo), se le
 * crea y se guarda en ese momento: desde ahí su orden queda fijo.
 */
export async function semillaDe(usuarioId: number): Promise<number> {
  const guardada = cache.get(usuarioId);
  if (guardada !== undefined) return guardada;
  const db = await getDb();
  const fila = await db.getFirstAsync<{ semilla: number | null }>('SELECT semilla FROM usuario WHERE id = ?;', [usuarioId]);
  let semilla = fila?.semilla ?? null;
  if (semilla === null) {
    semilla = nuevaSemilla();
    await db.runAsync('UPDATE usuario SET semilla = ? WHERE id = ? AND semilla IS NULL;', [semilla, usuarioId]);
  }
  cache.set(usuarioId, semilla);
  return semilla;
}

/** Al borrar un usuario o sus datos, que no se quede su semilla vieja en memoria. */
export function olvidarSemilla(usuarioId: number): void {
  cache.delete(usuarioId);
}
