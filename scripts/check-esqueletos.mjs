/**
 * Marca cualquier pantalla que cargue datos y no use el sistema de esqueletos.
 *
 * Una pantalla "carga datos" si:
 *   1. usa useCarga(), o
 *   2. lee de la base por su cuenta: importa de '@/db/...' una función de
 *      lectura (get*, leer*, cargar*, buscar*, listar*, obtener*, contar*) y
 *      la llama dentro de un efecto o con await/then.
 *
 * Y "usa esqueleto" si referencia <Carga, ProveedorEsqueleto, SkeletonLista,
 * un esqueleto a la medida (Esqueleto*) o mira `.demora` para pintar el suyo.
 * Las que caen en (2) sin esqueleto se quedan en blanco mientras leen.
 *
 * Una pantalla que lee de la base sin que se vea mientras tanto (Boot corre
 * bajo el splash) se declara en SIN_PANTALLA_DE_CARGA con la razón, en vez de
 * que el script mienta.
 *
 * Análisis estático de texto, igual que check-imports.mjs: no ejecuta nada.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src', 'screens');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

const MARCAS_ESQUELETO = [
  '<Carga', // el componente base ya trae esqueleto y fundido cruzado
  'ProveedorEsqueleto',
  'SkeletonLista',
  '<Esqueleto', // esqueletos a la medida (EsqueletoNiveles…)
  '.demora',
];

/** Leen de la base sin que nadie las vea esperar. Cada una con su razón. */
const SIN_PANTALLA_DE_CARGA = new Map([
  ['src/screens/entry/BootScreen.tsx', 'corre bajo el splash: App.tsx no lo esconde hasta que el arranque termina'],
]);

const LECTURA = /^(get|leer|cargar|buscar|listar|obtener|contar)[A-Z]/;

function leeDeLaBase(src) {
  const nombres = [];
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]@\/db\/[^'"]+['"]/g;
  let m;
  while ((m = re.exec(src))) {
    for (const parte of m[1].split(',')) {
      const nombre = parte.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
      if (nombre && LECTURA.test(nombre) && !parte.trim().startsWith('type ')) nombres.push(nombre);
    }
  }
  if (nombres.length === 0) return [];
  const asincrono = /\buse(Effect|FocusEffect|LayoutEffect)\s*\(|\bawait\b|\.then\(/.test(src);
  if (!asincrono) return [];
  return nombres.filter((n) => new RegExp(`\\b${n}\\s*\\(`).test(src));
}

const archivos = walk(SRC);
const faltantes = [];
let conCarga = 0;
let porSuCuenta = 0;

for (const f of archivos) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  const src = fs.readFileSync(f, 'utf8');
  const usaCarga = /\buseCarga\s*\(/.test(src);
  const lecturas = leeDeLaBase(src);
  if (!usaCarga && lecturas.length === 0) continue; // no carga datos: no aplica
  if (usaCarga) conCarga++;
  else porSuCuenta++;
  if (SIN_PANTALLA_DE_CARGA.has(rel)) continue;
  const tieneEsqueleto = MARCAS_ESQUELETO.some((m) => src.includes(m));
  if (!tieneEsqueleto) {
    faltantes.push(usaCarga ? rel : `${rel} (lee ${lecturas.join(', ')} sin useCarga)`);
  }
}

console.log(`pantallas con useCarga: ${conCarga}`);
console.log(`pantallas que leen de la base por su cuenta: ${porSuCuenta}`);
console.log(`declaradas sin pantalla de carga: ${SIN_PANTALLA_DE_CARGA.size}`);
console.log(`sin esqueleto: ${faltantes.length}`);
for (const f of faltantes) console.log(`  ${f}`);

process.exit(faltantes.length === 0 ? 0 : 1);
