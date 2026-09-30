/**
 * Genera el mapa de medios empaquetados: src/assets/bundled.ts (el índice chico) y un módulo por paquete en
 * src/assets/medios/, con un require() por cada archivo de assets/aud y assets/img.
 *
 * Metro necesita rutas estáticas: no se puede hacer require(variable). Por eso el mapa se genera.
 *
 * Por qué partido: con ~7.9k medios, un solo módulo con todo el índice se armaba completo la primera vez que alguien
 * preguntaba por un medio. Ahora bundled.ts solo sabe qué paquete le toca a cada ruta (por el id de la entrada y el
 * rango de ids de cada pack del catálogo, o por la carpeta) y el módulo de ese paquete se evalúa la primera vez que
 * se pide. Dentro de cada módulo, el require() de cada medio sigue corriendo al pedirse, no al cargar el módulo.
 *
 * Corre esto CADA VEZ que agregues o quites medios empaquetados:
 *     npm run build:assets
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'src/assets/bundled.ts');
const OUT_DIR = path.join(ROOT, 'src/assets/medios');
const DIRS = ['assets/aud', 'assets/img'];
const EXT = /\.(mp3|m4a|webp|png|jpg)$/i;

function walk(dir, base, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    // Las carpetas que empiezan con "_" (_respaldo_*, _viejo_*) no entran al bundle.
    if (e.isDirectory()) {
      if (!e.name.startsWith('_')) walk(full, base, out);
    } else if (EXT.test(e.name)) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

const files = [];
for (const d of DIRS) files.push(...walk(path.join(ROOT, d), path.join(ROOT, 'assets')));
files.sort();

// Los rangos de id de cada pack (los packs del catálogo son rangos contiguos de ids).
function rangosDePacks() {
  const f = path.join(ROOT, 'assets/data/catalogo.json');
  if (!fs.existsSync(f)) return [];
  let entries = [];
  try {
    entries = JSON.parse(fs.readFileSync(f, 'utf8')).entries ?? [];
  } catch {
    return [];
  }
  const porPack = new Map();
  for (const e of entries) {
    const r = porPack.get(e.pack_id) ?? [Infinity, -Infinity];
    porPack.set(e.pack_id, [Math.min(r[0], e.id), Math.max(r[1], e.id)]);
  }
  return [...porPack.values()].sort((a, b) => a[0] - b[0]);
}
const RANGOS = rangosDePacks();

/*
 * La regla ruta → paquete. Se escribe UNA vez aquí como texto: el generador la evalúa para repartir los archivos
 * y la misma función va dentro de bundled.ts para buscarlos. Así no pueden separarse.
 */
const CLAVE_SRC = `function claveDe(ruta: string): string {
  const partes = ruta.split('/');
  if (partes.length === 2) {
    // aud/12_en.mp3, img/12.webp: el medio de la entrada 12 va con su pack.
    const id = parseInt(partes[1] ?? '', 10);
    if (Number.isNaN(id)) return 'sueltos';
    let lo = 0;
    let hi = RANGOS.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = RANGOS[mid];
      if (!r) break;
      if (id < r[0]) hi = mid - 1;
      else if (id > r[1]) lo = mid + 1;
      else return 'pack' + mid;
    }
    return 'sueltos';
  }
  if (partes.length === 3) {
    // aud/phrasal es la carpeta grande (1.2k): se parte en cientos por el número del verbo.
    if (partes[1] === 'phrasal') {
      const n = parseInt(partes[2] ?? '', 10);
      if (!Number.isNaN(n)) return 'phrasal' + Math.floor(n / 100);
    }
    return partes[0] + '_' + partes[1];
  }
  return 'sueltos';
}`;
const claveDe = new Function('RANGOS', `return ${CLAVE_SRC.replace(/: string/g, '')};`)(RANGOS);

const grupos = new Map();
for (const f of files) {
  const k = claveDe(f);
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(f);
}
const claves = [...grupos.keys()].sort();

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const k of claves) {
  const lista = grupos.get(k);
  const indice = lista.map((f, i) => `  '${f}': ${i},`);
  const casos = lista.map((f, i) => `    case ${i}: return require('@assets/${f}');`);
  fs.writeFileSync(
    path.join(OUT_DIR, `${k}.ts`),
    `// GENERADO POR scripts/build-asset-map.mjs — NO EDITAR A MANO
// Los medios del paquete «${k}». Los require() viven dentro de un switch: cada uno corre la primera vez que se pide
// ese medio, no al cargar el módulo.

/** Ruta del JSON → índice en \`cargar\`. */
export const INDICE: Record<string, number> = {
${indice.join('\n')}
};

export function cargar(i: number): number | null {
  switch (i) {
${casos.join('\n')}
    default: return null;
  }
}
`,
    'utf8'
  );
}

const modulos = claves.map((k) => `  ${JSON.stringify(k)}: () => require('./medios/${k}'),`);
const body = `// GENERADO POR scripts/build-asset-map.mjs — NO EDITAR A MANO
// Corre "npm run build:assets" después de agregar o quitar medios.
//
// Metro solo entiende require() con ruta literal, así que el mapa de archivos empaquetados tiene que existir en el
// código fuente. Aquí solo va qué paquete le toca a cada ruta; el módulo del paquete (src/assets/medios/) se evalúa
// la primera vez que se pide uno de sus medios, y cada medio, la primera vez que se pide él.

interface Medios {
  INDICE: Record<string, number>;
  cargar: (i: number) => number | null;
}

/** Los rangos de id de cada pack del catálogo, en orden: pack0, pack1… */
const RANGOS: readonly (readonly [number, number])[] = ${JSON.stringify(RANGOS)};

const MODULOS: Record<string, () => Medios> = {
${modulos.join('\n')}
};

const cargados = new Map<string, Medios | null>();

${CLAVE_SRC}

function mediosDe(ruta: string): Medios | null {
  const k = claveDe(ruta);
  let m = cargados.get(k);
  if (m === undefined) {
    const cargar = Object.prototype.hasOwnProperty.call(MODULOS, k) ? MODULOS[k] : undefined;
    m = cargar ? cargar() : null;
    cargados.set(k, m);
  }
  return m;
}

/** Cuántos medios trae el binario. Lo muestra la pantalla de diagnóstico. */
export const BUNDLED_COUNT = ${files.length};

export function isBundled(relPath: string | null | undefined): boolean {
  if (!relPath) return false;
  const m = mediosDe(relPath);
  return Boolean(m && Object.prototype.hasOwnProperty.call(m.INDICE, relPath));
}

export function bundledModule(relPath: string): number | null {
  const m = mediosDe(relPath);
  const i = m && Object.prototype.hasOwnProperty.call(m.INDICE, relPath) ? m.INDICE[relPath] : undefined;
  return m && i !== undefined ? m.cargar(i) : null;
}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body, 'utf8');

const porTipo = files.reduce((acc, f) => {
  const k = f.startsWith('aud/') ? 'audio' : 'imagen';
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});

console.log(`\nsrc/assets/bundled.ts y src/assets/medios/ (${claves.length} paquetes) generados`);
console.log(`  audio:   ${porTipo.audio ?? 0}`);
console.log(`  imagen:  ${porTipo.imagen ?? 0}`);
console.log(`  total:   ${files.length}\n`);

if (files.length === 0) {
  console.log('  (assets/aud y assets/img están vacíos: es normal si');
  console.log('   todavía no generas los medios)\n');
}
