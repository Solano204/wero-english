/**
 * Recomprime el audio de la app con los perfiles aprobados (docs/PLAN-LISTAS-MEDIOS.md, prompt 5).
 * Mismos nombres y mismas rutas: la app y el mapa de medios no cambian.
 *
 *   node scripts/optimiza-audio.mjs            # solo dice qué haría y cuánto ahorra (no toca nada)
 *   node scripts/optimiza-audio.mjs --aplicar  # convierte; el original va a medios-originales/<misma ruta>
 *
 * Perfiles:
 *   voz     assets/aud/**.mp3   MP3 mono, 22,050 Hz, 32 kbps
 *   música  assets/music/*.mp3  MP3 estéreo, 44,100 Hz, 96 kbps
 *   efectos assets/sfx/**.wav   WAV PCM 16 bits, mono, 22,050 Hz (se quedan en WAV: MP3 y AAC meten silencio al
 *                               inicio y un efecto tiene que sonar en el mismo cuadro del toque)
 *
 * Un archivo que ya está en su perfil (o por debajo) se salta: correrlo dos veces no pierde calidad dos veces.
 * Si la versión nueva no pesa menos, se deja el original. Necesita ffmpeg y ffprobe en el PATH.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const APLICAR = process.argv.includes('--aplicar');
const ORIGINALES = path.join(ROOT, 'medios-originales');

export const PERFILES = [
  {
    nombre: 'voz',
    carpeta: 'assets/aud',
    ext: '.mp3',
    args: ['-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '32k'],
    // Ya está en perfil si es mono, ≤ 22,050 Hz y ≤ 36 kbps (margen del VBR/cabeceras).
    enPerfil: (i) => i.canales === 1 && i.tasa <= 22050 && i.kbps <= 36,
  },
  {
    nombre: 'música',
    carpeta: 'assets/music',
    ext: '.mp3',
    args: ['-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k'],
    enPerfil: (i) => i.kbps <= 100,
  },
  {
    nombre: 'efectos',
    carpeta: 'assets/sfx',
    ext: '.wav',
    args: ['-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le'],
    enPerfil: (i) => i.canales === 1 && i.tasa <= 22050,
  },
];

function info(archivo) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=sample_rate,channels,bit_rate:format=bit_rate',
    '-of', 'json', archivo,
  ]).toString();
  const j = JSON.parse(out);
  const s = j.streams?.[0] ?? {};
  const bits = Number(s.bit_rate ?? j.format?.bit_rate ?? 0);
  return { tasa: Number(s.sample_rate ?? 0), canales: Number(s.channels ?? 0), kbps: Math.round(bits / 1000) };
}

function archivos(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    // Las carpetas de respaldo y de prueba (ver .gitignore) no son de la app.
    if (e.isDirectory()) {
      if (!e.name.startsWith('_')) archivos(p, ext, out);
    } else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'optimiza-audio-'));
let totalAntes = 0;
let totalDespues = 0;

for (const perfil of PERFILES) {
  const lista = archivos(path.join(ROOT, perfil.carpeta), perfil.ext);
  let antes = 0;
  let despues = 0;
  let convertidos = 0;
  let saltados = 0;
  for (const archivo of lista) {
    const tam = fs.statSync(archivo).size;
    antes += tam;
    if (perfil.enPerfil(info(archivo))) {
      despues += tam;
      saltados++;
      continue;
    }
    const salida = path.join(tmp, `n${perfil.ext}`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', archivo, '-map_metadata', '-1', ...perfil.args, salida]);
    const nuevo = fs.statSync(salida).size;
    if (nuevo >= tam) {
      despues += tam;
      saltados++;
      continue;
    }
    despues += nuevo;
    convertidos++;
    if (APLICAR) {
      const rel = path.relative(ROOT, archivo);
      const respaldo = path.join(ORIGINALES, rel);
      fs.mkdirSync(path.dirname(respaldo), { recursive: true });
      if (!fs.existsSync(respaldo)) fs.copyFileSync(archivo, respaldo);
      fs.copyFileSync(salida, archivo);
    }
  }
  totalAntes += antes;
  totalDespues += despues;
  const pct = antes ? Math.round((1 - despues / antes) * 100) : 0;
  console.log(
    `${perfil.nombre.padEnd(8)} ${String(lista.length).padStart(5)} archivos · ${convertidos} a convertir, ${saltados} ya en perfil · ${kb(antes)} → ${kb(despues)} (−${pct} %)`,
  );
}

fs.rmSync(tmp, { recursive: true, force: true });
const pct = totalAntes ? Math.round((1 - totalDespues / totalAntes) * 100) : 0;
console.log(`total    ${kb(totalAntes)} → ${kb(totalDespues)} (−${pct} %)${APLICAR ? '' : '   (sin --aplicar no se tocó nada)'}`);
if (APLICAR) console.log(`originales en ${path.relative(ROOT, ORIGINALES)}/ (fuera de Git y del bundle)`);
