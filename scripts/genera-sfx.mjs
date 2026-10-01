/**
 * Genera los efectos cortos (acierto, fallo, toque…) como WAV PCM 16-bit mono a 44.1 kHz,
 * sin dependencias externas (solo fs/path de Node).
 *
 *   node scripts/genera-sfx.mjs
 *
 * Vuelve a correrlo si cambias los parámetros de abajo: sobrescribe los archivos existentes.
 *
 * Genera 4 juegos de los mismos 8 efectos:
 *   - assets/sfx/*.wav          "D", el actual (senoidal pura, sin tocar: es el punto de comparación).
 *   - assets/sfx/a/*.wav        "Cristal": campanas FM y marimba, con reverb corto.
 *   - assets/sfx/b/*.wav        "Beat": 808 afinado, ruido filtrado, acordes de sintetizador.
 *   - assets/sfx/c/*.wav        "Arcade suave": chiptune (cuadrada/triangular) filtrado, con eco corto.
 *
 * `success`, `fail`, `tap` y `match` llevan variantes (3 cada uno) para no repetirse; `success`
 * además tiene 5 alturas (pentatónica mayor) para la escalera de aciertos seguidos.
 *
 * Calibración de volumen: todo se normaliza a pico −1 dBFS. Para "~6 dB por debajo de la voz",
 * las voces del catálogo son MP3 (assets/aud/) y decodificar MP3 pediría una librería, que la
 * regla "sin dependencias nuevas" prohíbe — así que el objetivo de RMS de abajo
 * (`RMS_OBJETIVO_DBFS`) es una estimación razonada (voz hablada normalizada ronda entre −14 y
 * −18 dBFS de RMS integrado; se apunta 6 dB por debajo de esa banda), no una medición del
 * archivo real. Si en el teléfono se oye desbalanceado, es UNA constante para ajustar.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'assets/sfx');
const SAMPLE_RATE = 44100;
/** Techo de tamaño por archivo (KB), de la ficha. */
const TOPE_KB = 80;
/** RMS objetivo de los efectos: ~6 dB por debajo de una voz hablada normalizada (ver nota arriba). */
const RMS_OBJETIVO_DBFS = -22;
/** Pico objetivo tras normalizar. */
const PICO_OBJETIVO_DBFS = -1;

// ── utilidades de nivel ──────────────────────────────────────────────────
const dBaLineal = (db) => Math.pow(10, db / 20);
const linealAdB = (v) => 20 * Math.log10(Math.max(1e-9, v));

function pico(s) {
  let m = 0;
  for (let i = 0; i < s.length; i++) m = Math.max(m, Math.abs(s[i]));
  return m;
}
function rms(s) {
  let suma = 0;
  for (let i = 0; i < s.length; i++) suma += s[i] * s[i];
  return Math.sqrt(suma / Math.max(1, s.length));
}

/** Escala el pico a `objetivoDb` dBFS. Si además el RMS resultante pasaría de `techoRmsDb`, se queda ahí. */
function normaliza(s, { objetivoDb = PICO_OBJETIVO_DBFS, techoRmsDb = RMS_OBJETIVO_DBFS } = {}) {
  const p = pico(s);
  if (p <= 1e-9) return s;
  let ganancia = dBaLineal(objetivoDb) / p;
  const rmsConEsaGanancia = rms(s) * ganancia;
  const techoLineal = dBaLineal(techoRmsDb);
  if (rmsConEsaGanancia > techoLineal) ganancia *= techoLineal / rmsConEsaGanancia;
  const out = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s[i] * ganancia;
  return out;
}

// ── construcción de señales ──────────────────────────────────────────────
function silencio(ms) {
  return new Float64Array(Math.round((ms / 1000) * SAMPLE_RATE));
}

function concat(...trozos) {
  const total = trozos.reduce((n, c) => n + c.length, 0);
  const out = new Float64Array(total);
  let offset = 0;
  for (const c of trozos) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Suma varias señales de igual o distinta longitud (a partir del inicio), para superponer capas. */
function mezcla(...capas) {
  const total = Math.max(...capas.map((c) => c.length));
  const out = new Float64Array(total);
  for (const c of capas) for (let i = 0; i < c.length; i++) out[i] += c[i];
  return out;
}

function ms2n(ms) {
  return Math.max(1, Math.round((ms / 1000) * SAMPLE_RATE));
}

/**
 * Envolvente ADSR real (0 a 1): ataque lineal, decaimiento lineal hasta `sostenLvl`, tramo
 * sostenido y relajación lineal a 0. Si ataque+decaimiento+relajación no caben en `n`, se
 * recortan proporcionalmente (nunca se sale del arreglo).
 */
function adsr(n, { ataqueMs = 5, decaimientoMs = 15, sostenLvl = 0.6, relajacionMs = 40 } = {}) {
  let a = ms2n(ataqueMs);
  let d = ms2n(decaimientoMs);
  let r = ms2n(relajacionMs);
  if (a + d + r > n) {
    const f = n / (a + d + r);
    a = Math.floor(a * f);
    d = Math.floor(d * f);
    r = Math.max(0, n - a - d);
  }
  const s = Math.max(0, n - a - d - r);
  const out = new Float64Array(n);
  let i = 0;
  for (let k = 0; k < a; k++, i++) out[i] = a > 0 ? k / a : 1;
  for (let k = 0; k < d; k++, i++) out[i] = 1 + (sostenLvl - 1) * (d > 0 ? k / d : 1);
  for (let k = 0; k < s; k++, i++) out[i] = sostenLvl;
  for (let k = 0; k < r; k++, i++) out[i] = sostenLvl * (r > 0 ? 1 - k / r : 0);
  while (i < n) out[i++] = 0;
  return out;
}

function aplicaEnvolvente(onda, env) {
  const out = new Float64Array(onda.length);
  for (let i = 0; i < onda.length; i++) out[i] = onda[i] * (env[i] ?? 0);
  return out;
}

// ── osciladores (amplitud 1, sin envolvente: la pone quien los usa) ──────

/** Senoidal pura, con deslizamiento lineal de frecuencia si se da `freqFin`. */
function seno(freq, n, { freqFin } = {}) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = freqFin !== undefined ? freq + (freqFin - freq) * (i / n) : freq;
    out[i] = Math.sin(2 * Math.PI * f * t);
  }
  return out;
}

/** Suma de armónicos de `freq` con sus pesos relativos: timbre más rico que una senoidal sola. */
function armonicos(freq, n, pesos = [1, 0.5, 0.25]) {
  const out = new Float64Array(n);
  const total = pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (let h = 0; h < pesos.length; h++) s += pesos[h] * Math.sin(2 * Math.PI * freq * (h + 1) * t);
    out[i] = s / total;
  }
  return out;
}

/**
 * Síntesis FM (portadora + moduladora): con `indiceCae` el índice de modulación baja con el
 * tiempo, que es lo que hace sonar a campana (brillante al golpe, más puro al apagarse) en
 * vez de a sirena. `ratio` cercano a un entero da tonos más "afinados" (campana/marimba);
 * lejos de un entero, más metálico.
 */
function fm(freqPortadora, n, { ratio = 3.01, indice = 4, indiceCae = true } = {}) {
  const freqModuladora = freqPortadora * ratio;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const idx = indiceCae ? indice * (1 - i / n) : indice;
    const mod = idx * Math.sin(2 * Math.PI * freqModuladora * t);
    out[i] = Math.sin(2 * Math.PI * freqPortadora * t + mod);
  }
  return out;
}

function cuadrada(freq, n) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE)) >= 0 ? 1 : -1;
  return out;
}

/** Ruido blanco reproducible: mismo `semilla` da siempre el mismo resultado (build determinista). */
function ruido(n, semilla = 1) {
  let s = semilla >>> 0;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    out[i] = (s / 0xffffffff) * 2 - 1;
  }
  return out;
}

// ── filtros y efectos ─────────────────────────────────────────────────────

/** Pasa-bajos de un polo (RC): barato y suficiente para quitarle el filo a onda cuadrada/diente/ruido. */
function pasaBajos(s, cortesHz) {
  const rc = 1 / (2 * Math.PI * cortesHz);
  const dt = 1 / SAMPLE_RATE;
  const alfa = dt / (rc + dt);
  const out = new Float64Array(s.length);
  let prev = 0;
  for (let i = 0; i < s.length; i++) {
    prev += alfa * (s[i] - prev);
    out[i] = prev;
  }
  return out;
}

/** Pasa-altos de un polo: para dejar solo el "aire" de un ruido (golpes secos, claps). */
function pasaAltos(s, cortesHz) {
  const rc = 1 / (2 * Math.PI * cortesHz);
  const dt = 1 / SAMPLE_RATE;
  const alfa = rc / (rc + dt);
  const out = new Float64Array(s.length);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < s.length; i++) {
    const y = alfa * (prevOut + s[i] - prevIn);
    prevIn = s[i];
    prevOut = y;
    out[i] = y;
  }
  return out;
}

/** Saturación suave (tanh): calienta sin el recorte duro de un clip. `impulso` > 1 = más saturación. */
function saturaSuave(s, impulso = 2) {
  const norm = Math.tanh(impulso);
  const out = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = Math.tanh(s[i] * impulso) / norm;
  return out;
}

function filtroComb(x, retardoMuestras, realim) {
  const buf = new Float64Array(retardoMuestras);
  const out = new Float64Array(x.length);
  let p = 0;
  for (let i = 0; i < x.length; i++) {
    const atrasado = buf[p];
    const y = x[i] + realim * atrasado;
    out[i] = y;
    buf[p] = y;
    p = (p + 1) % retardoMuestras;
  }
  return out;
}

function filtroPasaTodo(x, retardoMuestras, ganancia) {
  const buf = new Float64Array(retardoMuestras);
  const out = new Float64Array(x.length);
  let p = 0;
  for (let i = 0; i < x.length; i++) {
    const atrasado = buf[p];
    const y = -ganancia * x[i] + atrasado;
    buf[p] = x[i] + ganancia * y;
    out[i] = y;
    p = (p + 1) % retardoMuestras;
  }
  return out;
}

/**
 * Reverb corto tipo Schroeder: 4 filtros peine en paralelo (retardos primos entre sí, para no
 * sonar metálico) sumados y mezclados con la señal seca, y 2 pasa-todo en serie para difuminar.
 * `colaMs` es cuánto tarda la cola en caer 60 dB; el resultado dura `x.length + colaMs` en total.
 */
function reverbSchroeder(x, { colaMs = 250, mezclaHumeda = 0.22 } = {}) {
  const retardosMs = [29.7, 37.1, 41.1, 43.7];
  const cauda = ms2n(colaMs);
  const extendido = concat(x, silencio(colaMs));
  const combs = retardosMs.map((ms) => {
    const d = ms2n(ms);
    const vueltas = cauda / d;
    const realim = Math.pow(0.001, 1 / Math.max(1, vueltas));
    return filtroComb(extendido, d, Math.min(0.97, realim));
  });
  let humedo = mezcla(...combs);
  for (let i = 0; i < humedo.length; i++) humedo[i] /= combs.length;
  humedo = filtroPasaTodo(humedo, ms2n(5), 0.5);
  humedo = filtroPasaTodo(humedo, ms2n(1.7), 0.5);
  const out = new Float64Array(extendido.length);
  for (let i = 0; i < out.length; i++) out[i] = extendido[i] * (1 - mezclaHumeda) + humedo[i] * mezclaHumeda;
  return out;
}

/** Eco discreto y barato (repeticiones que se apagan), para el chiptune: más "8 bits" que un reverb. */
function ecoCorto(x, { retardoMs = 70, repeticiones = 2, atenuacion = 0.35 } = {}) {
  const d = ms2n(retardoMs);
  const out = new Float64Array(x.length + d * repeticiones);
  out.set(x, 0);
  for (let r = 1; r <= repeticiones; r++) {
    const g = Math.pow(atenuacion, r);
    const offset = d * r;
    for (let i = 0; i < x.length; i++) out[offset + i] += x[i] * g;
  }
  return out;
}

// ── escala pentatónica mayor, para la escalera de aciertos ───────────────
const PENTATONICA_SEMITONOS = [0, 2, 4, 7, 9];
/** La frecuencia del escalón 1 a 5 sobre `raiz`, en la pentatónica mayor (afinación temperada). */
function alturaEscalon(raiz, escalon) {
  const semitonos = PENTATONICA_SEMITONOS[Math.max(1, Math.min(5, escalon)) - 1];
  return raiz * Math.pow(2, semitonos / 12);
}

// ── WAV ────────────────────────────────────────────────────────────────
function aWav(samples) {
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

// ════════════════════════════════════════════════════════════════════════
// PAQUETE D (el actual): senoidal pura, rampa lineal. Sin tocar: es la
// referencia contra la que se comparan los paquetes nuevos en el muestrario.
// ════════════════════════════════════════════════════════════════════════
function envolventeLineal(i, n, fadeSamples) {
  if (i < fadeSamples) return i / fadeSamples;
  if (i > n - fadeSamples) return (n - i) / fadeSamples;
  return 1;
}
function tonoD(freq, durationMs, { amplitude = 0.4, fadeMs = 10, freqEnd } = {}) {
  const n = Math.round((durationMs / 1000) * SAMPLE_RATE);
  const fadeSamples = Math.min(Math.round((fadeMs / 1000) * SAMPLE_RATE), Math.floor(n / 2));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = freqEnd !== undefined ? freq + (freqEnd - freq) * (i / n) : freq;
    out[i] = Math.sin(2 * Math.PI * f * t) * amplitude * envolventeLineal(i, n, fadeSamples);
  }
  return out;
}
function generaPaqueteD() {
  const success = concat(tonoD(880, 90, { amplitude: 0.45, fadeMs: 12 }), tonoD(1320, 90, { amplitude: 0.45, fadeMs: 12 }));
  const fail = tonoD(440, 220, { freqEnd: 330, amplitude: 0.3, fadeMs: 30 });
  const tap = tonoD(1200, 28, { amplitude: 0.22, fadeMs: 6 });
  const combo = concat(
    tonoD(740, 55, { amplitude: 0.4, fadeMs: 8 }),
    tonoD(990, 55, { amplitude: 0.4, fadeMs: 8 }),
    tonoD(1320, 70, { amplitude: 0.42, fadeMs: 10 })
  );
  const nivelCompleto = concat(
    tonoD(660, 110, { amplitude: 0.42, fadeMs: 10 }),
    tonoD(880, 110, { amplitude: 0.42, fadeMs: 10 }),
    tonoD(990, 110, { amplitude: 0.42, fadeMs: 10 }),
    silencio(20),
    tonoD(1320, 260, { amplitude: 0.46, fadeMs: 18 })
  );
  const match = tonoD(1050, 70, { amplitude: 0.35, fadeMs: 10 });
  const caidaPieza = tonoD(300, 90, { freqEnd: 140, amplitude: 0.38, fadeMs: 6 });
  const pista = concat(tonoD(700, 45, { amplitude: 0.3, fadeMs: 8 }), tonoD(950, 55, { amplitude: 0.32, fadeMs: 10 }));
  return {
    'success.wav': success,
    'fail.wav': fail,
    'tap.wav': tap,
    'combo.wav': combo,
    'nivel_completo.wav': nivelCompleto,
    'match.wav': match,
    'caida_pieza.wav': caidaPieza,
    'pista.wav': pista,
  };
}

// ════════════════════════════════════════════════════════════════════════
// PAQUETE A · Cristal — campanas FM y marimba, brillante pero suave, reverb corto.
// ════════════════════════════════════════════════════════════════════════
function campana(freq, ms, { indice = 4, ratio = 3.01, sostenLvl = 0.35, relajacionMs } = {}) {
  const n = ms2n(ms);
  const onda = fm(freq, n, { ratio, indice });
  const env = adsr(n, { ataqueMs: 3, decaimientoMs: Math.min(60, ms * 0.4), sostenLvl, relajacionMs: relajacionMs ?? ms * 0.5 });
  return aplicaEnvolvente(onda, env);
}
function marimba(freq, ms) {
  const n = ms2n(ms);
  const onda = armonicos(freq, n, [1, 0.35, 0.12]);
  const env = adsr(n, { ataqueMs: 2, decaimientoMs: ms * 0.3, sostenLvl: 0.2, relajacionMs: ms * 0.55 });
  return aplicaEnvolvente(onda, env);
}
// El reverb ALARGA el archivo por `colaMs` (no es un efecto "gratis" en duración): cada
// presupuesto de abajo ya resta esa cola de la ficha para no pasarse del tope.
function successCristal(raiz, escalon) {
  const f = alturaEscalon(raiz, escalon);
  const notas = concat(campana(f, 75, { indice: 3 }), campana(f * Math.pow(2, 4 / 12), 75, { indice: 3 }), campana(f * Math.pow(2, 7 / 12), 85, { indice: 3.5, sostenLvl: 0.4 }));
  return normaliza(reverbSchroeder(notas, { colaMs: 105, mezclaHumeda: 0.24 }));
}
function failCristal() {
  // Una sola nota grave, apagada: campana con índice bajo y decaimiento corto, nada de barrido.
  const golpe = campana(220, 165, { indice: 1.4, ratio: 1.99, sostenLvl: 0.15, relajacionMs: 105 });
  return normaliza(reverbSchroeder(golpe, { colaMs: 70, mezclaHumeda: 0.12 }));
}
function tapCristal(v) {
  const f = [2200, 2400, 2000][v];
  return normaliza(campana(f, 26, { indice: 1.2, sostenLvl: 0.05, relajacionMs: 16 }));
}
function matchCristal() {
  const pop = campana(1600, 58, { indice: 2.2, sostenLvl: 0.2, relajacionMs: 34 });
  return normaliza(reverbSchroeder(pop, { colaMs: 50, mezclaHumeda: 0.18 }));
}
function comboCristal() {
  const notas = concat(
    campana(660, 55, { indice: 3 }),
    campana(660 * Math.pow(2, 4 / 12), 55, { indice: 3 }),
    campana(660 * Math.pow(2, 7 / 12), 62, { indice: 3.4 }),
    campana(660 * Math.pow(2, 12 / 12), 90, { indice: 4, sostenLvl: 0.4 })
  );
  return normaliza(reverbSchroeder(notas, { colaMs: 120, mezclaHumeda: 0.3 }));
}
function caidaCristal() {
  const golpe = marimba(260, 95);
  return normaliza(reverbSchroeder(golpe, { colaMs: 45, mezclaHumeda: 0.1 }));
}
function pistaCristal() {
  const notas = concat(campana(1100, 78, { indice: 2.5, sostenLvl: 0.15 }), campana(1650, 85, { indice: 2.8, sostenLvl: 0.2 }));
  return normaliza(reverbSchroeder(notas, { colaMs: 115, mezclaHumeda: 0.22 }));
}
function nivelCompletoCristal() {
  const raiz = 523.25; // C5
  const pasos = [1, 2, 3, 4, 5, 5].map((esc, i) => campana(alturaEscalon(raiz, esc), i === 5 ? 150 : 75, { indice: i === 5 ? 4.5 : 3, sostenLvl: i === 5 ? 0.45 : 0.3 }));
  return normaliza(reverbSchroeder(concat(...pasos), { colaMs: 260, mezclaHumeda: 0.32 }));
}

// ════════════════════════════════════════════════════════════════════════
// PAQUETE B · Beat — 808 afinado, ruido filtrado, acordes cortos. Urbano, con ritmo.
// ════════════════════════════════════════════════════════════════════════
function kick808(freqInicial, freqFinal, ms, { sostenLvl = 0.25 } = {}) {
  const n = ms2n(ms);
  const onda = seno(freqInicial, n, { freqFin: freqFinal });
  const env = adsr(n, { ataqueMs: 1, decaimientoMs: ms * 0.35, sostenLvl, relajacionMs: ms * 0.55 });
  return saturaSuave(aplicaEnvolvente(onda, env), 1.4);
}
function golpeRuido(ms, { semilla = 1, cortesBajo = 1800, cortesAlto = 600, sostenLvl = 0.15 } = {}) {
  const n = ms2n(ms);
  let onda = ruido(n, semilla);
  onda = pasaBajos(onda, cortesBajo);
  onda = pasaAltos(onda, cortesAlto);
  const env = adsr(n, { ataqueMs: 1, decaimientoMs: ms * 0.4, sostenLvl, relajacionMs: ms * 0.5 });
  return aplicaEnvolvente(onda, env);
}
function stab(freq, ms, { pesos = [1, 0.6, 0.3], sostenLvl = 0.3 } = {}) {
  const n = ms2n(ms);
  const onda = pasaBajos(armonicos(freq, n, pesos), 3200);
  const env = adsr(n, { ataqueMs: 2, decaimientoMs: ms * 0.25, sostenLvl, relajacionMs: ms * 0.55 });
  return aplicaEnvolvente(onda, env);
}
function successBeat(raiz, escalon) {
  const f = alturaEscalon(raiz, escalon);
  const acorde = concat(stab(f, 90), stab(f * Math.pow(2, 4 / 12), 90), stab(f * Math.pow(2, 7 / 12), 130, { sostenLvl: 0.35 }));
  return normaliza(saturaSuave(acorde, 1.3));
}
function failBeat() {
  // Kick afinado, corto y apagado: nada de sirena ni distorsión dura.
  return normaliza(kick808(150, 55, 210, { sostenLvl: 0.18 }));
}
function tapBeat(v) {
  const semillas = [7, 19, 31];
  return normaliza(golpeRuido(22, { semilla: semillas[v], cortesBajo: 3500, cortesAlto: 1200, sostenLvl: 0.06 }));
}
function matchBeat() {
  // Clap suave: dos golpes de ruido muy juntos.
  const clap = concat(golpeRuido(25, { semilla: 3, cortesBajo: 2600, cortesAlto: 700, sostenLvl: 0.2 }), silencio(8), golpeRuido(60, { semilla: 5, cortesBajo: 2200, cortesAlto: 500, sostenLvl: 0.16 }));
  return normaliza(clap);
}
function comboBeat() {
  const acorde = concat(
    stab(494, 60),
    stab(494 * Math.pow(2, 4 / 12), 60),
    stab(494 * Math.pow(2, 7 / 12), 70),
    stab(494 * Math.pow(2, 12 / 12), 130, { sostenLvl: 0.4 })
  );
  return normaliza(saturaSuave(acorde, 1.6));
}
function caidaBeat() {
  return normaliza(kick808(180, 70, 140, { sostenLvl: 0.22 }));
}
function pistaBeat() {
  const blip = concat(stab(880, 55, { sostenLvl: 0.18 }), stab(1175, 70, { sostenLvl: 0.22 }));
  return normaliza(blip);
}
function nivelCompletoBeat() {
  const raiz = 440;
  const pasos = [1, 3, 5, 5].map((esc, i) => stab(alturaEscalon(raiz, esc), i === 3 ? 220 : 110, { sostenLvl: i === 3 ? 0.4 : 0.3 }));
  return normaliza(saturaSuave(concat(...pasos), 1.4));
}

// ════════════════════════════════════════════════════════════════════════
// PAQUETE C · Arcade suave — chiptune (cuadrada/triangular) filtrado, eco corto.
// ════════════════════════════════════════════════════════════════════════
function triangular(freq, n) {
  // Triangular = integral de la cuadrada: más redonda, menos chillona que la cuadrada sola.
  const cuad = cuadrada(freq, n);
  const out = new Float64Array(n);
  let acumulado = 0;
  const k = (4 * freq) / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    acumulado += cuad[i] * k;
    acumulado = Math.max(-1, Math.min(1, acumulado));
    out[i] = acumulado;
  }
  return out;
}
function chip(freq, ms, { onda = 'triangular', cortesHz = 4000, sostenLvl = 0.35 } = {}) {
  const n = ms2n(ms);
  let s = onda === 'cuadrada' ? cuadrada(freq, n) : triangular(freq, n);
  s = pasaBajos(s, cortesHz);
  const env = adsr(n, { ataqueMs: 2, decaimientoMs: ms * 0.3, sostenLvl, relajacionMs: ms * 0.5 });
  return aplicaEnvolvente(s, env);
}
// El eco ALARGA el archivo por `retardoMs * repeticiones`: igual que el reverb de Cristal,
// los presupuestos ya restan esa cola de la ficha.
function successArcade(raiz, escalon) {
  const f = alturaEscalon(raiz, escalon);
  const notas = concat(chip(f, 80, { onda: 'cuadrada' }), chip(f * Math.pow(2, 4 / 12), 80, { onda: 'cuadrada' }), chip(f * Math.pow(2, 7 / 12), 110, { onda: 'cuadrada', sostenLvl: 0.4 }));
  return normaliza(ecoCorto(notas, { retardoMs: 65, repeticiones: 1, atenuacion: 0.3 }));
}
function failArcade() {
  // Una sola nota grave y corta, sin barrido: onda triangular apagada.
  return normaliza(chip(180, 220, { onda: 'triangular', cortesHz: 1400, sostenLvl: 0.2 }));
}
function tapArcade(v) {
  const f = [1800, 1950, 1700][v];
  return normaliza(chip(f, 24, { onda: 'cuadrada', cortesHz: 5000, sostenLvl: 0.08 }));
}
function matchArcade() {
  const pop = chip(1200, 68, { onda: 'cuadrada', cortesHz: 4500, sostenLvl: 0.22 });
  return normaliza(ecoCorto(pop, { retardoMs: 45, repeticiones: 1, atenuacion: 0.25 }));
}
function comboArcade() {
  const notas = concat(
    chip(587, 55, { onda: 'cuadrada' }),
    chip(587 * Math.pow(2, 4 / 12), 55, { onda: 'cuadrada' }),
    chip(587 * Math.pow(2, 7 / 12), 65, { onda: 'cuadrada' }),
    chip(587 * Math.pow(2, 12 / 12), 120, { onda: 'cuadrada', cortesHz: 5200, sostenLvl: 0.42 })
  );
  return normaliza(ecoCorto(notas, { retardoMs: 55, repeticiones: 1, atenuacion: 0.32 }));
}
function caidaArcade() {
  const n = ms2n(120);
  const s = pasaBajos(seno(320, n, { freqFin: 150 }), 1600);
  return normaliza(aplicaEnvolvente(s, adsr(n, { ataqueMs: 1, decaimientoMs: 40, sostenLvl: 0.2, relajacionMs: 60 })));
}
function pistaArcade() {
  const notas = concat(chip(880, 60, { onda: 'triangular', sostenLvl: 0.2 }), chip(1320, 80, { onda: 'triangular', sostenLvl: 0.25 }));
  return normaliza(ecoCorto(notas, { retardoMs: 60, repeticiones: 1, atenuacion: 0.28 }));
}
function nivelCompletoArcade() {
  const raiz = 523.25;
  const pasos = [1, 2, 3, 4, 5, 5].map((esc, i) => chip(alturaEscalon(raiz, esc), i === 5 ? 200 : 100, { onda: 'cuadrada', sostenLvl: i === 5 ? 0.42 : 0.32 }));
  return normaliza(ecoCorto(concat(...pasos), { retardoMs: 80, repeticiones: 2, atenuacion: 0.3 }));
}

// ── ensamblado de un paquete completo (variantes + escalera) ─────────────
const RAICES = { a: 659.25, b: 440, c: 523.25 }; // E5, A4, C5: un color de raíz por paquete

function generaPaquete(id, gen) {
  const archivos = {};
  // success: 5 escalones × 3 variantes (una pequeña variación de índice/pesos entre variantes,
  // vía el número de variante que cada gen*() ya usa para el resto de sus efectos).
  for (let escalon = 1; escalon <= 5; escalon++) {
    for (let v = 0; v < 3; v++) {
      archivos[`success_h${escalon}_v${v + 1}.wav`] = gen.success(RAICES[id], escalon, v);
    }
  }
  // fail y match no cambian con la variante: un solo archivo (paquetesSfx lo usa en los tres huecos).
  archivos['fail_1.wav'] = gen.fail(0);
  for (let v = 0; v < 3; v++) archivos[`tap_${v + 1}.wav`] = gen.tap(v);
  archivos['match_1.wav'] = gen.match(0);
  archivos['combo.wav'] = gen.combo();
  archivos['caida_pieza.wav'] = gen.caidaPieza();
  archivos['pista.wav'] = gen.pista();
  archivos['nivel_completo.wav'] = gen.nivelCompleto();
  return archivos;
}

/** Pequeño detune por variante (en semitonos) para que las 3 no suenen idénticas. */
const DETUNE_VARIANTE = [0, -0.4, 0.5];

const PAQUETES = {
  a: generaPaquete('a', {
    success: (raiz, esc, v) => successCristal(raiz * Math.pow(2, DETUNE_VARIANTE[v] / 12), esc),
    fail: () => failCristal(),
    tap: (v) => tapCristal(v),
    match: () => matchCristal(),
    combo: () => comboCristal(),
    caidaPieza: () => caidaCristal(),
    pista: () => pistaCristal(),
    nivelCompleto: () => nivelCompletoCristal(),
  }),
  b: generaPaquete('b', {
    success: (raiz, esc, v) => successBeat(raiz * Math.pow(2, DETUNE_VARIANTE[v] / 12), esc),
    fail: () => failBeat(),
    tap: (v) => tapBeat(v),
    match: () => matchBeat(),
    combo: () => comboBeat(),
    caidaPieza: () => caidaBeat(),
    pista: () => pistaBeat(),
    nivelCompleto: () => nivelCompletoBeat(),
  }),
  c: generaPaquete('c', {
    success: (raiz, esc, v) => successArcade(raiz * Math.pow(2, DETUNE_VARIANTE[v] / 12), esc),
    fail: () => failArcade(),
    tap: (v) => tapArcade(v),
    match: () => matchArcade(),
    combo: () => comboArcade(),
    caidaPieza: () => caidaArcade(),
    pista: () => pistaArcade(),
    nivelCompleto: () => nivelCompletoArcade(),
  }),
};

// ── escritura + reporte ───────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });

const reporte = [];
function escribe(subdir, archivos) {
  const dir = subdir ? path.join(OUT_DIR, subdir) : OUT_DIR;
  fs.mkdirSync(dir, { recursive: true });
  for (const [nombre, muestras] of Object.entries(archivos)) {
    const buf = aWav(muestras);
    fs.writeFileSync(path.join(dir, nombre), buf);
    reporte.push({
      archivo: path.join(subdir || '.', nombre),
      duracionMs: Math.round((muestras.length / SAMPLE_RATE) * 1000),
      kb: Math.round((buf.length / 1024) * 10) / 10,
      picoDb: Math.round(linealAdB(pico(muestras)) * 10) / 10,
    });
  }
}

escribe(null, generaPaqueteD());
escribe('a', PAQUETES.a);
escribe('b', PAQUETES.b);
escribe('c', PAQUETES.c);

console.log(`Generados ${reporte.length} archivos en assets/sfx/ (D, a/, b/, c/).\n`);
console.log('archivo'.padEnd(28), 'ms'.padStart(6), 'KB'.padStart(8), 'pico dB'.padStart(10));
let fueraDeTope = 0;
for (const r of reporte) {
  if (r.kb > TOPE_KB) fueraDeTope++;
  console.log(r.archivo.padEnd(28), String(r.duracionMs).padStart(6), String(r.kb).padStart(8), String(r.picoDb).padStart(10));
}
if (fueraDeTope > 0) {
  console.error(`\n${fueraDeTope} archivo(s) pasan de ${TOPE_KB} KB.`);
  process.exit(1);
}
console.log(`\nTodos por debajo de ${TOPE_KB} KB.`);
