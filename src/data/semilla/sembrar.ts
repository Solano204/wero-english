import { Asset } from 'expo-asset';
import { getDb } from '@/data/cliente';
import { getAppMeta, setAppMeta } from '@/data/repos/ajustes';
import { vaciarDistractores } from '@/data/repos/distractores';
import { ENTRADAS_CATALOGO, HUELLA_CATALOGO } from '@/data/resumenContenido';

const CATALOG_VERSION_KEY = 'catalog_version';

export interface SeedProgress {
  done: number;
  total: number;
}

/**
 * Siembra el catálogo en SQLite desde la base prearmada (assets/data/catalogo.db, la genera
 * `npm run build:derivados` desde catalogo.json). Idempotente: si el conteo, la huella y el audio ya
 * están, no hace nada, así que se llama en cada arranque sin costo y sin evaluar el JSON.
 *
 * Cuando sí hace falta (primera instalación o catálogo nuevo), adjunta catalogo.db y copia sus filas en
 * una sola transacción. Es un upsert, nunca un DELETE de lo que ya estaba: `tarjeta` apunta a `entrada`
 * con ON DELETE CASCADE, y borrar el catálogo para resembrarlo borraba también el avance de cada frase.
 * Solo se borran las entradas que el catálogo nuevo ya no trae (y con ellas sus tarjetas, que ya no
 * tienen frase).
 */
export async function seedCatalog(
  onProgress?: (p: SeedProgress) => void
): Promise<{ inserted: number; skipped: boolean }> {
  const db = await getDb();

  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM entrada;');
  const existing = row?.n ?? 0;
  const storedVersion = await getAppMeta(CATALOG_VERSION_KEY);
  const countMatches = existing === ENTRADAS_CATALOGO;

  // Solo se consulta si falta audio cuando el conteo ya coincide: si no coincide, de todas formas se
  // resiembra completo más abajo.
  const missingAudio =
    countMatches && existing > 0
      ? ((await db.getFirstAsync<{ n: number }>(
          "SELECT COUNT(*) AS n FROM entrada WHERE audio_en IS NULL OR audio_en = '';"
        ))?.n ?? 0) > 0
      : false;

  if (countMatches && !missingAudio && storedVersion === HUELLA_CATALOGO) {
    return { inserted: 0, skipped: true };
  }

  const asset = await Asset.fromModule(require('@data/catalogo.db')).downloadAsync();
  if (!asset.localUri) throw new Error('No se pudo abrir el catálogo.');
  const ruta = decodeURI(asset.localUri.replace(/^file:\/\//, '')).replace(/'/g, "''");

  // ATTACH no se puede dentro de una transacción: va antes, y el DETACH después.
  await db.execAsync(`ATTACH DATABASE '${ruta}' AS semilla;`);
  try {
    const columnas = (await db.getAllAsync<{ name: string }>('PRAGMA semilla.table_info(entrada);')).map(
      (c) => `"${c.name}"`
    );
    const actualizar = columnas.filter((c) => c !== '"id"').map((c) => `${c} = excluded.${c}`);
    await db.withTransactionAsync(async () => {
      await db.execAsync(
        `INSERT INTO entrada (${columnas.join(',')})
           SELECT ${columnas.join(',')} FROM semilla.entrada WHERE true
           ON CONFLICT(id) DO UPDATE SET ${actualizar.join(', ')};`
      );
      await db.execAsync('DELETE FROM entrada WHERE id NOT IN (SELECT id FROM semilla.entrada);');
      await setAppMeta(CATALOG_VERSION_KEY, HUELLA_CATALOGO);
    });
  } finally {
    await db.execAsync('DETACH DATABASE semilla;');
  }

  // El pool de distractores se armó con el catálogo anterior: se vuelve a leer en la próxima tarjeta.
  vaciarDistractores();
  onProgress?.({ done: ENTRADAS_CATALOGO, total: ENTRADAS_CATALOGO });
  return { inserted: ENTRADAS_CATALOGO, skipped: false };
}

/** Cuántas entradas hay ya en la base. Lo usa la pantalla de diagnóstico. */
export async function countEntries(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM entrada;');
  return row?.n ?? 0;
}
