/**
 * Genera src/assets/bundled.ts con un require() por cada archivo que
 * esté en assets/aud y assets/img.
 *
 * Metro necesita rutas estáticas: no se puede hacer require(variable).
 * Por eso hay que generar el mapa en vez de resolverlo en runtime.
 *
 * Corre esto CADA VEZ que agregues o quites medios empaquetados:
 *     npm run build:assets
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'src/assets/bundled.ts');
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
for (const d of DIRS) {
  files.push(...walk(path.join(ROOT, d), path.join(ROOT, 'assets')));
}
files.sort();

const lines = files.map(
  (f) => `  '${f}': require('../../assets/${f}'),`
);

const body = `// GENERADO POR scripts/build-asset-map.mjs — NO EDITAR A MANO
// Corre "npm run build:assets" después de agregar o quitar medios.
//
// Metro solo entiende require() con ruta literal, así que el mapa de
// archivos empaquetados tiene que existir en el código fuente.

/** Los medios que van dentro del APK, indexados por su ruta del JSON. */
export const BUNDLED: Record<string, number> = {
${lines.join('\n')}
};

/** Cuántos medios trae el binario. Lo muestra la pantalla de diagnóstico. */
export const BUNDLED_COUNT = ${files.length};

export function isBundled(relPath: string | null | undefined): boolean {
  return Boolean(relPath && relPath in BUNDLED);
}

export function bundledModule(relPath: string): number | null {
  return BUNDLED[relPath] ?? null;
}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body, 'utf8');

const porTipo = files.reduce((acc, f) => {
  const k = f.startsWith('aud/') ? 'audio' : 'imagen';
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});

console.log(`\nsrc/assets/bundled.ts generado`);
console.log(`  audio:   ${porTipo.audio ?? 0}`);
console.log(`  imagen:  ${porTipo.imagen ?? 0}`);
console.log(`  total:   ${files.length}\n`);

if (files.length === 0) {
  console.log('  (assets/aud y assets/img están vacíos: es normal si');
  console.log('   todavía no generas los medios)\n');
}
