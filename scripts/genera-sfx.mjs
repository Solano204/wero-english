/**
 * Genera los efectos cortos de acierto/fallo como WAV PCM 16-bit, sin
 * dependencias externas (solo fs/path de Node).
 *
 *   node scripts/genera-sfx.mjs
 *
 * Vuelve a correrlo si cambias los parámetros de abajo: sobrescribe los
 * archivos existentes en assets/sfx/.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'assets/sfx');
const SAMPLE_RATE = 44100;

/** Rampa lineal de entrada/salida para que el corte no truene (click). */
function envelope(i, n, fadeSamples) {
  if (i < fadeSamples) return i / fadeSamples;
  if (i > n - fadeSamples) return (n - i) / fadeSamples;
  return 1;
}

/**
 * Un tono, con deslizamiento lineal de frecuencia si se da `freqEnd`
 * (así "fail" es un solo barrido descendente, no dos notas).
 */
function tone(freq, durationMs, { amplitude = 0.4, fadeMs = 10, freqEnd } = {}) {
  const n = Math.round((durationMs / 1000) * SAMPLE_RATE);
  const fadeSamples = Math.min(Math.round((fadeMs / 1000) * SAMPLE_RATE), Math.floor(n / 2));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = freqEnd !== undefined ? freq + (freqEnd - freq) * (i / n) : freq;
    out[i] = Math.sin(2 * Math.PI * f * t) * amplitude * envelope(i, n, fadeSamples);
  }
  return out;
}

function concat(...chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float64Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Silencio entre notas, para que un arpegio no suene a acorde pegado. */
function silence(durationMs) {
  return new Float64Array(Math.round((durationMs / 1000) * SAMPLE_RATE));
}

function toWav(samples) {
  const dataSize = samples.length * 2; // mono, 16-bit
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits por muestra
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buffer;
}

// success: "ping" de dos notas ascendentes, cortas y contentas.
const success = concat(
  tone(880, 90, { amplitude: 0.45, fadeMs: 12 }),
  tone(1320, 90, { amplitude: 0.45, fadeMs: 12 })
);

// fail: un solo barrido suave hacia abajo. Nada de acorde ni distorsión:
// el diseño dice que fallar nunca debe sentirse como regaño.
const fail = tone(440, 220, { freqEnd: 330, amplitude: 0.3, fadeMs: 30 });

// tap: clic muy corto y discreto. Se toca en cada ficha, así que tiene
// que desaparecer detrás del gesto, no notarse encima de él.
const tap = tone(1200, 28, { amplitude: 0.22, fadeMs: 6 });

// combo/racha: arpegio de tres notas, más rápido y más agudo que
// success. Marca que algo se está acumulando, no un acierto suelto.
const combo = concat(
  tone(740, 55, { amplitude: 0.4, fadeMs: 8 }),
  tone(990, 55, { amplitude: 0.4, fadeMs: 8 }),
  tone(1320, 70, { amplitude: 0.42, fadeMs: 10 })
);

// nivel_completo: pequeña fanfarria de cuatro notas, la última más
// larga. Es la única celebración "grande" del set; el resto son cortas
// a propósito para no cansar en partidas con muchas rondas.
const nivelCompleto = concat(
  tone(660, 110, { amplitude: 0.42, fadeMs: 10 }),
  tone(880, 110, { amplitude: 0.42, fadeMs: 10 }),
  tone(990, 110, { amplitude: 0.42, fadeMs: 10 }),
  silence(20),
  tone(1320, 260, { amplitude: 0.46, fadeMs: 18 })
);

// match (Pares/Dulces): un solo "cling" brillante y corto. Pasa muy
// seguido en Dulces, así que va más suave y más breve que success.
const match = tone(1050, 70, { amplitude: 0.35, fadeMs: 10 });

// caida_pieza: un golpe seco y grave, como algo que aterriza. Barrido
// descendente corto con ataque rápido, nada de tono sostenido.
const caidaPieza = tone(300, 90, { freqEnd: 140, amplitude: 0.38, fadeMs: 6 });

// pista: un empujoncito suave, dos notas cortas y cercanas. Distinto de
// tap (más discreto) y de match (más brillante): es "toma, una ayuda",
// no un acierto ni un golpe.
const pista = concat(
  tone(700, 45, { amplitude: 0.3, fadeMs: 8 }),
  tone(950, 55, { amplitude: 0.32, fadeMs: 10 })
);

fs.mkdirSync(OUT_DIR, { recursive: true });
const archivos = {
  'success.wav': success,
  'fail.wav': fail,
  'tap.wav': tap,
  'combo.wav': combo,
  'nivel_completo.wav': nivelCompleto,
  'match.wav': match,
  'caida_pieza.wav': caidaPieza,
  'pista.wav': pista,
};
for (const [nombre, muestras] of Object.entries(archivos)) {
  fs.writeFileSync(path.join(OUT_DIR, nombre), toWav(muestras));
}

console.log('Generado en assets/sfx/:', Object.keys(archivos).join(', '));
