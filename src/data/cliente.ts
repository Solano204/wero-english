import * as SQLite from 'expo-sqlite';
import { MIGRATIONS, SCHEMA_VERSION } from './esquema';

const DB_NAME = 'wero.db';

let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Devuelve la conexión, abriéndola la primera vez.
 * Guarda la promesa en curso para que dos llamadas concurrentes durante
 * el arranque no abran la base dos veces.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (opening) return opening;

  opening = (async () => {
    const conn = await SQLite.openDatabaseAsync(DB_NAME);
    try {
      // WAL da lecturas concurrentes mientras se escribe: sin esto la UI
      // se congela cuando se siembra el catálogo o se descarga un pack.
      await conn.execAsync('PRAGMA journal_mode = WAL;');
      await conn.execAsync('PRAGMA foreign_keys = ON;');
      await conn.execAsync('PRAGMA synchronous = NORMAL;');

      await migrate(conn);
    } catch (e) {
      await conn.closeAsync().catch(() => undefined);
      throw e;
    }
    db = conn;
    return conn;
  })();

  try {
    return await opening;
  } catch (e) {
    // Sin esto, un fallo al abrir o migrar se quedaba guardado y cada llamada siguiente fallaba igual hasta
    // reiniciar la app: ahora la próxima llamada lo vuelve a intentar.
    opening = null;
    throw e;
  }
}

async function migrate(conn: SQLite.SQLiteDatabase): Promise<void> {
  const row = await conn.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;'
  );
  const current = row?.user_version ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    // La versión se escribe dentro de la misma transacción: si la app se cierra a la mitad, o quedan las dos cosas o
    // ninguna (antes, un cierre entre las dos volvía a correr la migración al abrir).
    await conn.withTransactionAsync(async () => {
      await conn.execAsync(m.sql);
      await conn.execAsync(`PRAGMA user_version = ${m.version};`);
    });
  }

  if (current > SCHEMA_VERSION) {
    // La base es más nueva que el código: pasa si el usuario instala una
    // versión vieja encima. Mejor avisar que corromper datos en silencio.
    if (__DEV__) console.warn(
      `[db] La base está en v${current} y el código espera v${SCHEMA_VERSION}.`
    );
  }
}

/** Cierra la conexión. Solo para pruebas y para borrar la cuenta. */
export async function closeDb(): Promise<void> {
  if (!db) return;
  await db.closeAsync();
  db = null;
  opening = null;
}

/** Borra todo. Lo usa "borrar mis datos" en ajustes. */
export async function wipeDb(): Promise<void> {
  await closeDb();
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
