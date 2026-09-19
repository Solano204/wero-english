/**
 * Falla si aparece un color literal fuera de src/theme/.
 *
 *   npm run check:color
 *
 * Busca hex (#rgb, #rgba, #rrggbb, #rrggbbaa) y rgb( / rgba( en src/ y App.tsx,
 * sin contar comentarios. Todo color sale de src/theme/tokens.ts.
 * Sale con código 1 y lista archivo:línea si encuentra alguno.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TEMA = path.join(ROOT, 'src', 'theme');
const COLOR = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?!\w)|\brgba?\s*\(/;

/** Quita comentarios de línea y de bloque sin tocar las cadenas ni el número de líneas. */
export function sinComentarios(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      const fin = src.indexOf('*/', i + 2);
      const bloque = src.slice(i, fin < 0 ? src.length : fin + 2);
      out += bloque.replace(/[^\n]/g, '');
      i += bloque.length;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function autoprueba() {
  const hallazgos = (s) => sinComentarios(s).split('\n').filter((l) => COLOR.test(l)).length;
  const casos = [
    ["const a = '#FFF';", 1],
    ["const a = '#ffffff80';", 1],
    ['const a = `rgba(0, 0, 0, 0.5)`;', 1],
    ['const a = rgb(1,2,3);', 1],
    ["// color: '#fff'", 0],
    ['/* rgba(0,0,0,1) */ const a = 1;', 0],
    ['/**\n * usa #000000\n */\nconst a = 1;', 0],
    ["{/* '#fff' */}", 0],
    ["const a = 1; // '#fff'", 0],
    ["const n = 'Nivel #1'; const a = color.bg;", 0],
    ["const u = 'https://x.com/#abc';", 1],
  ];
  for (const [src, esperado] of casos) {
    const real = hallazgos(src);
    if (real !== esperado) throw new Error(`autoprueba: ${JSON.stringify(src)} dio ${real}, esperaba ${esperado}`);
  }
  console.log(`autoprueba: ${casos.length} casos ok`);
}

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p !== TEMA) archivos(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

if (process.argv.includes('--test')) {
  autoprueba();
} else {
  const lista = archivos(path.join(ROOT, 'src')).concat(path.join(ROOT, 'App.tsx'));
  const hallazgos = [];
  for (const f of lista) {
    const original = fs.readFileSync(f, 'utf8').split('\n');
    sinComentarios(original.join('\n'))
      .split('\n')
      .forEach((l, i) => {
        if (COLOR.test(l)) hallazgos.push(`${path.relative(ROOT, f).split(path.sep).join('/')}:${i + 1}  ${original[i].trim().slice(0, 90)}`);
      });
  }
  console.log(`archivos revisados: ${lista.length}`);
  console.log(`colores fuera de src/theme/: ${hallazgos.length}`);
  for (const h of hallazgos) console.log(`  ${h}`);
  if (hallazgos.length) process.exit(1);
}
