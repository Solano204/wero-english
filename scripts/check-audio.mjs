/**
 * Verifica que toda pantalla que reproduce sonido (audio.play*, <AudioButton>
 * o speech.listenOnce) también use useCortarAudioAlSalir(), para que nada
 * siga sonando al perder el foco.
 *
 * Análisis estático de texto, igual que check-imports.mjs: no ejecuta nada.
 */
import path from 'node:path';
import { fuenteDePantalla, pantallas } from './lib/pantallas.mjs';

const ROOT = process.cwd();

// Pantallas donde reproducir sonido está intencionalmente fuera de este
// corte (ninguna hoy: se deja el arreglo por si hace falta una excepción
// documentada más adelante, en vez de que el script empiece a mentir).
const PERMITIDAS = new Set([]);

const REPRODUCE = [/\baudio\.play\w*\s*\(/, /<AudioButton\b/, /\bspeech\.listenOnce\s*\(/];
const USA_HOOK = /\buseCortarAudioAlSalir\s*\(/;

const sinCorte = [];
let pantallasConAudio = 0;

// Cada pantalla con lo que es suyo (sus hooks y su logic): el corte puede vivir en el hook de la partida.
for (const f of pantallas(ROOT)) {
  const rel = path.relative(ROOT, f);
  const src = fuenteDePantalla(f, ROOT);
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
