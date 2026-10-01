/**
 * Muestras de audio ANTES/DESPUÉS para aprobar el perfil de optimización (prompt 5, docs/PLAN-LISTAS-MEDIOS.md).
 * No toca assets/: copia 5 audios de voz y escribe al lado su versión con el perfil propuesto.
 *
 *   node scripts/muestras-audio.mjs [carpetaSalida=muestras-audio]
 *
 * Necesita ffmpeg en el PATH (el mismo que usan scripts/ordena.mjs y scripts/gemini.mjs).
 * Perfil propuesto para voz: MP3 mono, 22,050 Hz, 32 kbps (hoy Polly entrega MP3 mono 22,050 Hz; se compara la
 * tasa real de cada archivo en la salida).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SALIDA = path.resolve(process.argv[2] ?? 'muestras-audio');
export const PERFIL_VOZ = ['-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '32k'];

// Una de cada tipo: frase en inglés, frase en español, fonema, lectura y phrasal (la primera que exista).
const BUSCAR = [/^aud\/\d+_en\.mp3$/, /^aud\/\d+_es\.mp3$/, /^aud\/fon\//, /^aud\/lec\//, /^aud\/phrasal\//];
const todos = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.mp3$/.test(e.name)) todos.push(path.relative(path.join(ROOT, 'assets'), p).split(path.sep).join('/'));
  }
})(path.join(ROOT, 'assets/aud'));
if (todos.length === 0) {
  console.error('No hay audios en assets/aud: corre esto donde están los medios.');
  process.exit(1);
}

const tasa = (f) =>
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels,bit_rate', '-of', 'csv=p=0', f])
    .toString()
    .trim();

fs.mkdirSync(SALIDA, { recursive: true });
let n = 0;
for (const re of BUSCAR) {
  const rel = todos.find((t) => re.test(t));
  if (!rel) continue;
  n++;
  const base = `${n}-${rel.replace(/[/.]/g, '_')}`;
  const antes = path.join(SALIDA, `${base}-antes.mp3`);
  const despues = path.join(SALIDA, `${base}-despues.mp3`);
  fs.copyFileSync(path.join(ROOT, 'assets', rel), antes);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', antes, ...PERFIL_VOZ, despues]);
  const a = fs.statSync(antes).size, d = fs.statSync(despues).size;
  console.log(`${rel}: ${a} B (${tasa(antes)}) → ${d} B (${tasa(despues)})  ${Math.round((1 - d / a) * 100)} % menos`);
}
console.log(`\n${n} muestras en ${SALIDA}`);
