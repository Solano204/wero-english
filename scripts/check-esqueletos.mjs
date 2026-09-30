/**
 * Marca cualquier pantalla que cargue datos con useCarga y no use el sistema
 * de esqueletos (Carga/ProveedorEsqueleto/SkeletonLista, o al menos mire
 * `.demora` para pintar algo a la medida). Una pantalla que hace fetch y no
 * referencia ninguno de los dos se queda en blanco o en spinner mientras carga.
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
  '<Carga', // el componente base ya trae esqueleto/crossfade
  'ProveedorEsqueleto',
  'SkeletonLista',
  '.demora',
];

const archivos = walk(SRC);
const faltantes = [];

for (const f of archivos) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/\buseCarga\s*\(/.test(src)) continue; // no carga datos: no aplica
  const tieneEsqueleto = MARCAS_ESQUELETO.some((m) => src.includes(m));
  if (!tieneEsqueleto) faltantes.push(path.relative(ROOT, f));
}

console.log(`pantallas analizadas (con useCarga): ${archivos.filter((f) => /\buseCarga\s*\(/.test(fs.readFileSync(f, 'utf8'))).length}`);
console.log(`sin esqueleto: ${faltantes.length}`);
for (const f of faltantes) console.log(`  ${f}`);

process.exit(faltantes.length === 0 ? 0 : 1);
