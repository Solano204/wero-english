/**
 * Verifica que toda pantalla que reproduce sonido (audio.play*, <AudioButton>
 * o speech.listenOnce) también use useCortarAudioAlSalir(), para que nada
 * siga sonando al perder el foco.
 *
 * Análisis estático de texto, igual que check-imports.mjs: no ejecuta nada.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCREENS = path.join(ROOT, 'src', 'screens');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Pantallas donde reproducir sonido está intencionalmente fuera de este
// corte (ninguna hoy: se deja el arreglo por si hace falta una excepción
// documentada más adelante, en vez de que el script empiece a mentir).
const PERMITIDAS = new Set([]);

const REPRODUCE = [/\baudio\.play\w*\s*\(/, /<AudioButton\b/, /\bspeech\.listenOnce\s*\(/];
const USA_HOOK = /\buseCortarAudioAlSalir\s*\(/;

const sinCorte = [];
let pantallasConAudio = 0;

for (const f of walk(SCREENS)) {
  const rel = path.relative(ROOT, f);
  const src = fs.readFileSync(f, 'utf8');
  const reproduce = REPRODUCE.some((re) => re.test(src));
  if (!reproduce) continue;
  pantallasConAudio++;
  if (PERMITIDAS.has(rel)) continue;
  if (!USA_HOOK.test(src)) sinCorte.push(rel);
}

console.log(`pantallas que reproducen sonido: ${pantallasConAudio}`);
console.log(`sin useCortarAudioAlSalir(): ${sinCorte.length}`);
for (const f of sinCorte) console.log(`  ${f}`);

process.exit(sinCorte.length === 0 ? 0 : 1);
