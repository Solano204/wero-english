import { getDb } from '@/data/cliente';
import { getAppMeta, setAppMeta } from '@/data/repos/ajustes';
import type { Catalog, Entry } from '@/types';

const CATALOG_VERSION_KEY = 'catalog_version';

/** Cuántas filas por INSERT. Más de 200 y SQLite se queja del límite
 *  de variables enlazadas (999 por defecto, y aquí van 38 por fila). */
const CHUNK = 20;

export interface SeedProgress {
  done: number;
  total: number;
}

/**
 * Huella del catálogo: versión de esquema + conteo + suma de longitudes
 * de audio_en/audio_es. No es criptográfico, solo detecta "el JSON
 * cambió" para decidir si hay que resembrar (p. ej. una migración que
 * llenó columnas nuevas pero dejó el conteo de filas intacto).
 */
function catalogVersionOf(catalog: Catalog): string {
  let audioLen = 0;
  for (const e of catalog.entries) {
    audioLen += (e.audio_en?.length ?? 0) + (e.audio_es?.length ?? 0);
  }
  return `${catalog.schema_version}:${catalog.entries.length}:${audioLen}`;
}

/**
 * Siembra el catálogo en SQLite. Idempotente: si el conteo, la versión
 * del catálogo y el audio ya están completos no hace nada, así que se
 * puede llamar en cada arranque sin costo.
 */
export async function seedCatalog(
  catalog: Catalog,
  onProgress?: (p: SeedProgress) => void
): Promise<{ inserted: number; skipped: boolean }> {
  const db = await getDb();

  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM entrada;'
  );
  const existing = row?.n ?? 0;

  const version = catalogVersionOf(catalog);
  const storedVersion = await getAppMeta(CATALOG_VERSION_KEY);
  const countMatches = existing === catalog.entries.length;

  // Solo se consulta si falta audio cuando el conteo ya coincide: si no
  // coincide, de todas formas se resiembra completo más abajo.
  const missingAudio =
    countMatches && existing > 0
      ? ((await db.getFirstAsync<{ n: number }>(
          "SELECT COUNT(*) AS n FROM entrada WHERE audio_en IS NULL OR audio_en = '';"
        ))?.n ?? 0) > 0
      : false;

  if (countMatches && !missingAudio && storedVersion === version) {
    return { inserted: 0, skipped: true };
  }

  // El catálogo cambió (conteo, audio faltante o versión): se rehace
  // completo. Las tablas de progreso no se tocan porque son otras tablas.
  if (existing > 0) {
    await db.execAsync('DELETE FROM entrada;');
  }

  const cols = [
    'id', 'phrase', 'phrase_tts', 'phrase_alt', 'ipa', 'ipa_note',
    'spanish', 'spanish_main', 'es_neutro', 'note',
    'topic', 'block', 'volume', 'tipo', 'nivel', 'vigencia', 'registro',
    'tiempo_verbal', 'word_count',
    'vulgaridad', 'vulgaridad_en', 'vulgaridad_es', 'vulgar_marks',
    'no_usar_cuando',
    'pack_id', 'mundo', 'pack_final',
    'duplicate_of', 'is_canonical', 'revisar',
    'escena_imagen', 'completar_palabra', 'completar_distractores',
    'regla_grupo', 'palabras_practica', 'audio_en', 'audio_es', 'imagen',
  ];
  const placeholders = `(${cols.map(() => '?').join(',')})`;

  let inserted = 0;
  const total = catalog.entries.length;

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < total; i += CHUNK) {
      const slice = catalog.entries.slice(i, i + CHUNK);
      const sql =
        `INSERT INTO entrada (${cols.join(',')}) VALUES ` +
        slice.map(() => placeholders).join(',') +
        ';';
      const args = slice.flatMap(flatten);
      await db.runAsync(sql, args);
      inserted += slice.length;
      onProgress?.({ done: inserted, total });
    }
    await setAppMeta(CATALOG_VERSION_KEY, version);
  });

  return { inserted, skipped: false };
}

function flatten(e: Entry): (string | number | null)[] {
  return [
    e.id, e.phrase, e.phrase_tts, e.phrase_alt, e.ipa, e.ipa_note,
    e.spanish, e.spanish_main, e.es_neutro, e.note,
    e.topic, e.block, e.volume, e.tipo, e.nivel, e.vigencia, e.registro,
    e.tiempo_verbal, e.word_count,
    e.vulgaridad, e.vulgaridad_en, e.vulgaridad_es,
    JSON.stringify(e.vulgar_marks ?? []),
    e.no_usar_cuando,
    e.pack_id, e.mundo, e.pack_final,
    e.duplicate_of, e.is_canonical ? 1 : 0, e.revisar ? 1 : 0,
    e.escena_imagen, e.completar_palabra,
    JSON.stringify(e.completar_distractores ?? []),
    e.regla_grupo,
    JSON.stringify(e.palabras_practica ?? []),
    e.audio_en, e.audio_es, e.imagen,
  ];
}

/** Cuántas entradas hay ya en la base. Lo usa la pantalla de arranque. */
export async function countEntries(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM entrada;'
  );
  return row?.n ?? 0;
}
