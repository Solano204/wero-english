/**
 * Recomprime las imágenes de la app (docs/PLAN-LISTAS-MEDIOS.md, prompt 5). Mismos nombres y rutas.
 *
 *   node scripts/optimiza-imagenes.mjs            # solo dice cuánto ahorraría (no toca nada)
 *   node scripts/optimiza-imagenes.mjs --aplicar  # reemplaza; el original va a medios-originales/<misma ruta>
 *
 * WebP q80 con el esfuerzo máximo del codificador (ffmpeg, que las genera en scripts/gemini.mjs, usa el medio), y nunca
 * más grande que el tamaño de su carpeta (el mismo FORMATO que gemini.mjs). Una imagen solo se reemplaza si baja al menos
 * un 5 %: volver a codificar un WebP con pérdida por una ganancia menor no vale la calidad que cuesta.
 *
 * Necesita sharp (no es dependencia de la app): `npm i --no-save sharp`.
 */
import fs from 'node:fs';
import path from 'node:path';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Falta sharp: npm i --no-save sharp');
  process.exit(1);
}

const ROOT = process.cwd();
const APLICAR = process.argv.includes('--aplicar');
const ORIGINALES = path.join(ROOT, 'medios-originales');
const MINIMO = 0.05;

// El mismo tamaño final por carpeta que scripts/gemini.mjs.
const FORMATO = {
  'img/mundos': { w: 1200, h: 400 },
  'img/juegos': { w: 1200, h: 400 },
  'img/fon': { w: 512, h: 512 },
  'img/wero': { w: 512, h: 512 },
};
const POR_DEFECTO = { w: 640, h: 640 };

function archivos(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!e.name.startsWith('_')) archivos(p, out);
    } else if (/\.(webp|png|jpe?g)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const lista = archivos(path.join(ROOT, 'assets/img'));
const porCarpeta = new Map();
let antes = 0;
let despues = 0;
let reemplazos = 0;
let grandes = 0;

for (const archivo of lista) {
  const rel = path.relative(path.join(ROOT, 'assets'), archivo).split(path.sep).join('/');
  const carpeta = path.posix.dirname(rel);
  const f = FORMATO[carpeta] ?? POR_DEFECTO;
  const tam = fs.statSync(archivo).size;
  const meta = await sharp(archivo).metadata();
  if ((meta.width ?? 0) > f.w || (meta.height ?? 0) > f.h) grandes++;
  const nuevo = await sharp(archivo)
    .resize({ width: f.w, height: f.h, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 6, smartSubsample: true })
    .toBuffer();

  const gana = /\.webp$/i.test(archivo) && nuevo.length <= tam * (1 - MINIMO);
  const final = gana ? nuevo.length : tam;
  antes += tam;
  despues += final;
  const c = porCarpeta.get(carpeta) ?? { n: 0, antes: 0, despues: 0 };
  c.n++;
  c.antes += tam;
  c.despues += final;
  porCarpeta.set(carpeta, c);
  if (!gana) continue;
  reemplazos++;
  if (APLICAR) {
    const respaldo = path.join(ORIGINALES, 'assets', rel);
    fs.mkdirSync(path.dirname(respaldo), { recursive: true });
    if (!fs.existsSync(respaldo)) fs.copyFileSync(archivo, respaldo);
    fs.writeFileSync(archivo, nuevo);
  }
}

for (const [carpeta, c] of [...porCarpeta].sort()) {
  console.log(`${carpeta.padEnd(16)} ${String(c.n).padStart(5)} · ${kb(c.antes)} → ${kb(c.despues)}`);
}
const pct = antes ? Math.round((1 - despues / antes) * 100) : 0;
console.log(`${lista.length} imágenes · ${reemplazos} bajan ≥ ${MINIMO * 100} % · ${grandes} más grandes que su formato`);
console.log(`total ${kb(antes)} → ${kb(despues)} (−${pct} %)${APLICAR ? '' : '   (sin --aplicar no se tocó nada)'}`);
if (APLICAR && reemplazos) console.log(`originales en ${path.relative(ROOT, ORIGINALES)}/ (fuera de Git y del bundle)`);
if (lista.length === 0) console.log('assets/img está vacía: corre esto donde están los medios.');
