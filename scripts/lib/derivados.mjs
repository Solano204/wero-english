/**
 * Los derivados de assets/data que la app usa en vez de evaluar los JSON grandes al abrir. Los escribe
 * scripts/build-derivados.mjs (npm run build:derivados) y los revisa check:data: tienen que coincidir con los JSON.
 *
 *  - src/data/resumenContenido.ts: conteos y la huella del catálogo (lo que Boot y Practicar necesitan).
 *  - assets/data/cazala_entradas.json: las entradas del catálogo que usan las rondas de Cázala.
 *  - assets/data/catalogo.db: la tabla `entrada` ya armada, para sembrar la base copiándola (ver data/semilla).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const RUTA_RESUMEN = 'src/data/resumenContenido.ts';
export const RUTA_CAZALA = 'assets/data/cazala_entradas.json';
export const RUTA_DB = 'assets/data/catalogo.db';

const leer = (root, nombre) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'assets/data', nombre), 'utf8'));
  } catch {
    return null;
  }
};

/** Las columnas de `entrada` que trae el catálogo, en el orden en que se siembran. */
export const COLUMNAS = [
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

/** Una entrada del JSON como fila de `entrada` (mismos valores que sembraba la app). */
export function fila(e) {
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
  ].map((v) => (v === undefined ? null : v));
}

/**
 * Huella del catálogo: versión de esquema + conteo + suma de longitudes de audio_en/audio_es. Es la misma que
 * guardaba la app al sembrar (app_meta.catalog_version), así que una instalación existente no se resiembra por el
 * cambio de método.
 */
export function huellaCatalogo(catalog) {
  let audioLen = 0;
  for (const e of catalog.entries) audioLen += (e.audio_en?.length ?? 0) + (e.audio_es?.length ?? 0);
  return `${catalog.schema_version}:${catalog.entries.length}:${audioLen}`;
}

/** sha256 del catalogo.json: catalogo.db lo guarda para que check:data sepa si quedó viejo. */
export function hashCatalogo(root = process.cwd()) {
  const f = path.join(root, 'assets/data/catalogo.json');
  return fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : '';
}

const catalogoDe = (root) => {
  const c = leer(root, 'catalogo.json');
  return c && Array.isArray(c.entries) ? c : { schema_version: 0, entries: [] };
};

export function textoResumen(root = process.cwd()) {
  const phrasal = leer(root, 'phrasal_verbs.json');
  const verbos = Array.isArray(phrasal?.verbos) ? phrasal.verbos.length : 0;
  const catalogo = catalogoDe(root);
  return `// GENERADO POR scripts/build-derivados.mjs — NO EDITAR A MANO
// Corre "npm run build:derivados" después de cambiar los JSON de assets/data (check:data avisa si quedó viejo).

/** Cuántos phrasal verbs trae phrasal_verbs.json: el dato del renglón de Phrasal en Practicar, sin cargar el JSON. */
export const PHRASAL_VERBOS: number = ${verbos};

/** Cuántas entradas trae el catálogo (assets/data/catalogo.db). */
export const ENTRADAS_CATALOGO: number = ${catalogo.entries.length};

/** La huella del catálogo: si la base guardó otra, Boot vuelve a sembrar desde catalogo.db. */
export const HUELLA_CATALOGO: string = ${JSON.stringify(huellaCatalogo(catalogo))};
`;
}

/** Las entradas que usan las rondas de Cázala (opciones, reducciones y distractores), en orden de id. */
export function textoCazala(root = process.cwd()) {
  const contracciones = leer(root, 'contracciones.json');
  const ids = new Set();
  for (const it of contracciones?.cazala ?? []) {
    for (const k of ['opciones', 'reducciones', 'distractores']) for (const id of it[k] ?? []) ids.add(id);
  }
  const entradas = catalogoDe(root).entries.filter((e) => ids.has(e.id)).sort((a, b) => a.id - b.id);
  return JSON.stringify({ generado_de: 'catalogo.json + contracciones.json', entries: entradas }) + '\n';
}

/** Arma catalogo.db (necesita node:sqlite, Node 22.13 o más nuevo). */
export async function construirDb(root = process.cwd()) {
  const { DatabaseSync } = await import('node:sqlite');
  const destino = path.join(root, RUTA_DB);
  fs.rmSync(destino, { force: true });
  const db = new DatabaseSync(destino);
  db.exec(`CREATE TABLE entrada (${COLUMNAS.join(', ')});`);
  db.exec('CREATE TABLE meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);');
  const catalogo = catalogoDe(root);
  const insertar = db.prepare(`INSERT INTO entrada VALUES (${COLUMNAS.map(() => '?').join(', ')});`);
  db.exec('BEGIN;');
  for (const e of catalogo.entries) insertar.run(...fila(e));
  const meta = db.prepare('INSERT INTO meta VALUES (?, ?);');
  meta.run('huella', huellaCatalogo(catalogo));
  meta.run('sha256', hashCatalogo(root));
  db.exec('COMMIT;');
  db.exec('VACUUM;');
  db.close();
  return catalogo.entries.length;
}

/** Lo que dice catalogo.db de sí mismo (para check:data), o null si no existe o no se puede abrir. */
export async function metaDb(root = process.cwd()) {
  const f = path.join(root, RUTA_DB);
  if (!fs.existsSync(f)) return null;
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(f, { readOnly: true });
    const meta = Object.fromEntries(db.prepare('SELECT clave, valor FROM meta;').all().map((r) => [r.clave, r.valor]));
    const n = db.prepare('SELECT COUNT(*) AS n FROM entrada;').get().n;
    db.close();
    return { ...meta, entradas: n };
  } catch {
    return null;
  }
}
