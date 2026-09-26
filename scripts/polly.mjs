#!/usr/bin/env node
/**
 * Genera los mp3 de Wero con Amazon Polly.
 *
 *   node scripts/polly.mjs --plan                 qué falta y cuánto cuesta
 *   node scripts/polly.mjs --grupo "Catálogo EN"  genera un grupo
 *   node scripts/polly.mjs --solo 18 8 1023       genera unos ids sueltos
 *   node scripts/polly.mjs --todo                 genera todo lo que falte
 *   node scripts/polly.mjs --revisa               valida lo ya generado
 *
 *   node scripts/polly.mjs --marcas --plan        marcas de palabra que faltan y cuánto cuestan
 *   node scripts/polly.mjs --marcas --solo 1      prueba con una frase antes de gastar más
 *   node scripts/polly.mjs --marcas               genera las marcas que falten (Catálogo EN)
 *   node scripts/polly.mjs --consolida            rehace assets/data/marcas.json sin llamar a Polly
 *
 *   node scripts/polly.mjs --marcas-oraciones --plan             marcas de oración de los capítulos de las lecturas
 *   node scripts/polly.mjs --marcas-oraciones --solo lec_ninos_01_1   prueba con un capítulo
 *   node scripts/polly.mjs --marcas-oraciones                    genera las que falten (lee lecturas.json, no el manifiesto)
 *   node scripts/polly.mjs --consolida-oraciones                 rehace assets/data/marcas_oraciones.json sin llamar a Polly
 *   (SpeechMarkTypes ["sentence"]; las usa la lectura acompañada. Sin ellas la app estima por caracteres.)
 *
 * Las marcas (SpeechMarkTypes ["word"], OutputFormat json) son las horas de cada
 * palabra que usa el karaoke de Estudio. Sale un JSON por audio en
 * assets/data/marcas/ y uno consolidado en assets/data/marcas.json, que es el que
 * empaqueta la app. Sin marcas la app estima por sílabas, así que son opcionales.
 * Se cobran por carácter como el audio (confirma la tarifa vigente en la página de
 * precios de Polly); el --plan imprime la estimación con la tarifa de este script.
 *
 * Es reanudable: si el archivo ya existe y pesa lo suficiente, no lo vuelve
 * a pedir. Puedes cortar con Ctrl+C y volver a lanzar sin pagar dos veces.
 *
 * Lee assets/medios.json, que es el manifiesto. No inventa texto: cada mp3
 * sale del campo `texto` de su fila.
 */

import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ejecuta = promisify(execFile);
const RAIZ = path.resolve(import.meta.dirname, "..");
const MANIFIESTO = path.join(RAIZ, "assets", "medios.json");
const REGISTRO = path.join(RAIZ, ".polly-log.json");
const DIR_MARCAS = path.join(RAIZ, "assets", "data", "marcas");
const INDICE_MARCAS = path.join(RAIZ, "assets", "data", "marcas.json");
// Estudio solo usa el audio en inglés del catálogo: el resto no necesita marcas.
const GRUPO_MARCAS = "Catálogo EN";

// ── voces ────────────────────────────────────────────────────────────────
// Matthew y Andrés son la MISMA identidad de voz en dos idiomas. Es la
// capacidad polyglot del motor generativo: el inglés suena a gringo y el
// español suena a mexicano, pero es la misma persona. Por eso el catálogo
// bilingüe no se oye como dos locutores pegados.
const VOCES = {
  en: { VoiceId: "Matthew",  LanguageCode: "en-US", Engine: "generative" },
  es: { VoiceId: "Andres",   LanguageCode: "es-MX", Engine: "generative" },
  narracion: { VoiceId: "Danielle", LanguageCode: "en-US", Engine: "generative" },
  // El motor generative no soporta <phoneme>: el sonido aislado de cada
  // fonema (fonemas.json) necesita el motor neural, que sí lo procesa.
  fonAislado: { VoiceId: "Matthew", LanguageCode: "en-US", Engine: "neural" },
};

// El motor generativo solo da soporte PARCIAL a <prosody> y a <phoneme>.
// Por eso el audio lento NO se pide con SSML: se genera a velocidad normal
// y se ralentiza con ffmpeg, que conserva el tono y no depende del motor.
const FACTOR_LENTO = 0.72;

const REGION = process.env.AWS_REGION || "us-east-1";
// Regiones con motor generativo, a septiembre de 2026.
const REGIONES_GENERATIVE = new Set([
  "us-east-1", "us-west-2", "eu-central-1", "eu-west-2", "ca-central-1",
  "ap-northeast-1", "ap-northeast-2", "ap-southeast-1", "eu-central-2",
]);

const MIN_BYTES = 3000;        // menos que esto casi siempre es fallo silencioso
const MAX_CHARS = 2900;        // el límite facturable de SynthesizeSpeech es 3000
const PAUSA_MS = 120;          // entre llamadas, para no chocar con el throttle
const REINTENTOS = 4;
// Tarifa de lista por motor, USD por millón de caracteres. El costo real
// depende de qué motor use cada fila (VOCES[idioma(fila)].Engine), no es
// uno solo para todo el manifiesto desde que "fonAislado" usa neural.
const PRECIO_POR_MOTOR = { generative: 30, neural: 16, standard: 4 };

const cliente = new PollyClient({ region: REGION });

// ── utilidades ───────────────────────────────────────────────────────────
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (n) => "$" + n.toFixed(2);

function idioma(fila) {
  if (fila.voz) return fila.voz;
  if (fila.grupo === "Catálogo ES") return "es";
  if (fila.grupo === "Lecturas") return "narracion";
  return "en";
}

function precioPorCaracter(fila) {
  const motor = VOCES[idioma(fila)]?.Engine ?? "generative";
  return (PRECIO_POR_MOTOR[motor] ?? 30) / 1e6;
}

async function yaEsta(destino) {
  if (!existsSync(destino)) return false;
  const s = await stat(destino);
  return s.size >= MIN_BYTES;
}

/** Parte un texto largo por oraciones sin pasar de MAX_CHARS. */
function trocea(texto) {
  if (texto.length <= MAX_CHARS) return [texto];
  const trozos = [];
  let actual = "";
  for (const frase of texto.split(/(?<=[.!?])\s+/)) {
    if ((actual + " " + frase).trim().length > MAX_CHARS) {
      if (actual) trozos.push(actual.trim());
      actual = frase;
    } else {
      actual = (actual + " " + frase).trim();
    }
  }
  if (actual) trozos.push(actual.trim());
  return trozos;
}

async function sintetiza(texto, voz, esSsml, extra = {}) {
  let ultimo;
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      const r = await cliente.send(new SynthesizeSpeechCommand({
        ...VOCES[voz],
        Text: texto,
        TextType: esSsml ? "ssml" : "text",
        OutputFormat: "mp3",
        SampleRate: "22050",
        ...extra,
      }));
      const trozos = [];
      for await (const t of r.AudioStream) trozos.push(t);
      return Buffer.concat(trozos);
    } catch (e) {
      ultimo = e;
      // ThrottlingException y errores 5xx sí se reintentan; el resto no.
      const reintentable = /Throttl|TooManyRequests|ServiceUnavailable|InternalFailure/i
        .test(e.name || "") || (e.$metadata?.httpStatusCode >= 500);
      if (!reintentable) throw e;
      await dormir(500 * 2 ** intento);
    }
  }
  throw ultimo;
}

async function genera(fila) {
  const destino = path.join(RAIZ, "assets", fila.archivo);
  await mkdir(path.dirname(destino), { recursive: true });

  // El lento se deriva del normal: no se paga dos veces.
  if (fila.derivado_de) {
    const origen = path.join(RAIZ, "assets", fila.derivado_de);
    if (!(await yaEsta(origen))) {
      throw new Error(`falta el original ${fila.derivado_de}`);
    }
    await ejecuta("ffmpeg", ["-y", "-i", origen,
      "-filter:a", `atempo=${FACTOR_LENTO}`, "-b:a", "48k", "-ac", "1", destino]);
    return { chars: 0, derivado: true };
  }

  // El SSML nunca se trocea: cortarlo a media etiqueta (<phoneme>,
  // <prosody>) lo deja XML inválido. Sus textos son cortos, así que
  // entran enteros bajo MAX_CHARS de todos modos.
  const trozos = fila.ssml ? [fila.texto] : trocea(fila.texto);
  const voz = idioma(fila);
  const partes = [];
  for (const t of trozos) {
    partes.push(await sintetiza(t, voz, fila.ssml));
    await dormir(PAUSA_MS);
  }
  const audio = Buffer.concat(partes);
  if (audio.length < MIN_BYTES && fila.texto.length > 12) {
    throw new Error(`salió de ${audio.length} bytes, sospechoso`);
  }
  await writeFile(destino, audio);
  return { chars: fila.texto.length, trozos: trozos.length };
}

// ── marcas de palabra ────────────────────────────────────────────────────
const nombreMarcas = (fila) => path.basename(fila.archivo, path.extname(fila.archivo)) + ".json";

async function yaEstanMarcas(fila) {
  const destino = path.join(DIR_MARCAS, nombreMarcas(fila));
  if (!existsSync(destino)) return false;
  try {
    const j = JSON.parse(await readFile(destino, "utf8"));
    return Array.isArray(j.m) && j.m.length > 0;
  } catch {
    return false;
  }
}

/** Pide las marcas de palabra de una frase y las guarda: [[ms, palabra], ...]. */
async function generaMarcas(fila) {
  const crudo = await sintetiza(fila.texto, idioma(fila), false, {
    OutputFormat: "json",
    SpeechMarkTypes: ["word"],
    SampleRate: undefined,
  });
  const m = crudo.toString("utf8").split("\n").filter(Boolean)
    .map((linea) => JSON.parse(linea))
    .filter((x) => x.type === "word")
    .map((x) => [x.time, x.value]);
  if (m.length === 0) throw new Error("Polly no devolvió marcas de palabra");
  await mkdir(DIR_MARCAS, { recursive: true });
  await writeFile(path.join(DIR_MARCAS, nombreMarcas(fila)),
    JSON.stringify({ archivo: fila.archivo, texto: fila.texto, m }) + "\n");
  return { chars: fila.texto.length };
}

/** Junta los JSON de assets/data/marcas/ en el índice que empaqueta la app: { ruta: { m } }. */
async function consolidaMarcas() {
  const indice = {};
  if (existsSync(DIR_MARCAS)) {
    for (const nombre of (await readdir(DIR_MARCAS)).sort()) {
      if (!nombre.endsWith(".json")) continue;
      try {
        const j = JSON.parse(await readFile(path.join(DIR_MARCAS, nombre), "utf8"));
        if (j.archivo && Array.isArray(j.m) && j.m.length > 0) indice[j.archivo] = { m: j.m };
      } catch {
        console.error(`  saltado ${nombre}: JSON inválido`);
      }
    }
  }
  await writeFile(INDICE_MARCAS, JSON.stringify(indice) + "\n");
  console.log(`assets/data/marcas.json: ${Object.keys(indice).length} audios con marcas`);
}

// ── marcas de oración de las lecturas ────────────────────────────────────
// La lectura acompañada resalta la oración que suena. Las marcas salen del texto de cada capítulo de lecturas.json
// (no del manifiesto): así los desplazamientos son los del texto que dibuja la app. Un capítulo de más de MAX_CHARS
// caracteres se narró en varias llamadas y sus marcas no se pueden juntar sin la duración de cada trozo: se salta y la
// app lo estima.
const LECTURAS = path.join(RAIZ, "assets", "data", "lecturas.json");
const DIR_MARCAS_ORACIONES = path.join(RAIZ, "assets", "data", "marcas_oraciones");
const INDICE_MARCAS_ORACIONES = path.join(RAIZ, "assets", "data", "marcas_oraciones.json");

async function filasLecturas() {
  const doc = JSON.parse(await readFile(LECTURAS, "utf8"));
  return doc.lecturas.flatMap((l) =>
    l.capitulos.filter((c) => c.audio).map((c) => ({
      recurso: `${l.id}_${c.n}`,
      archivo: c.audio,
      texto: c.texto,
      grupo: "Lecturas",
      voz: "narracion",
    }))
  );
}

async function yaEstanMarcasOraciones(fila) {
  const destino = path.join(DIR_MARCAS_ORACIONES, nombreMarcas(fila));
  if (!existsSync(destino)) return false;
  try {
    const j = JSON.parse(await readFile(destino, "utf8"));
    return j.n === fila.texto.length && Array.isArray(j.s) && j.s.length > 0;
  } catch {
    return false;
  }
}

/**
 * Pide las marcas de oración de un capítulo y las guarda: { archivo, n, s: [[ms, inicio, fin], ...] } con `inicio` y
 * `fin` en caracteres del texto. Polly los da en bytes de UTF-8: se convierten.
 */
async function generaMarcasOraciones(fila) {
  if (fila.texto.length > MAX_CHARS) throw new Error(`capítulo de ${fila.texto.length} caracteres: se narró en varias llamadas, se estima`);
  const crudo = await sintetiza(fila.texto, idioma(fila), false, {
    OutputFormat: "json",
    SpeechMarkTypes: ["sentence"],
    SampleRate: undefined,
  });
  const bytes = Buffer.from(fila.texto, "utf8");
  const aCaracter = (b) => bytes.subarray(0, b).toString("utf8").length;
  const s = crudo.toString("utf8").split("\n").filter(Boolean)
    .map((linea) => JSON.parse(linea))
    .filter((x) => x.type === "sentence")
    .map((x) => [x.time, aCaracter(x.start), aCaracter(x.end)]);
  if (s.length === 0) throw new Error("Polly no devolvió marcas de oración");
  await mkdir(DIR_MARCAS_ORACIONES, { recursive: true });
  await writeFile(path.join(DIR_MARCAS_ORACIONES, nombreMarcas(fila)),
    JSON.stringify({ archivo: fila.archivo, n: fila.texto.length, s }) + "\n");
  return { chars: fila.texto.length };
}

/** Junta los JSON de assets/data/marcas_oraciones/ en el índice que empaqueta la app: { ruta: { n, s } }. */
async function consolidaMarcasOraciones() {
  const indice = {};
  if (existsSync(DIR_MARCAS_ORACIONES)) {
    for (const nombre of (await readdir(DIR_MARCAS_ORACIONES)).sort()) {
      if (!nombre.endsWith(".json")) continue;
      try {
        const j = JSON.parse(await readFile(path.join(DIR_MARCAS_ORACIONES, nombre), "utf8"));
        if (j.archivo && Number.isFinite(j.n) && Array.isArray(j.s) && j.s.length > 0) indice[j.archivo] = { n: j.n, s: j.s };
      } catch {
        console.error(`  saltado ${nombre}: JSON inválido`);
      }
    }
  }
  await writeFile(INDICE_MARCAS_ORACIONES, JSON.stringify(indice) + "\n");
  console.log(`assets/data/marcas_oraciones.json: ${Object.keys(indice).length} capítulos con marcas de oración`);
}

// ── entrada ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const bandera = (n) => args.includes(n);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

// No necesita el manifiesto ni a Polly: solo junta lo que ya está en assets/data/marcas/.
if (bandera("--consolida")) {
  await consolidaMarcas();
  process.exit(0);
}
if (bandera("--consolida-oraciones")) {
  await consolidaMarcasOraciones();
  process.exit(0);
}

// Marcas de oración de los capítulos de las lecturas: no usa el manifiesto, lee lecturas.json.
if (bandera("--marcas-oraciones")) {
  const solo = valor("--solo");
  const todas = (await filasLecturas()).filter((f) => !solo || f.recurso === solo);
  const faltan = [];
  for (const f of todas) if (!(await yaEstanMarcasOraciones(f))) faltan.push(f);
  const pedibles = faltan.filter((f) => f.texto.length <= MAX_CHARS);
  const chars = pedibles.reduce((t, f) => t + f.texto.length, 0);
  const costo = pedibles.reduce((t, f) => t + f.texto.length * precioPorCaracter(f), 0);

  if (bandera("--plan")) {
    console.log(`\nregión ${REGION}` + (REGIONES_GENERATIVE.has(REGION) ? "" : "   ← SIN motor generativo, cámbiala"));
    console.log(`faltan marcas de oración de ${faltan.length} de ${todas.length} capítulos (${faltan.length - pedibles.length} son demasiado largos y se estiman)`);
    console.log(`  ${String(chars).padStart(6)}  caracteres facturables`);
    console.log(`  costo estimado: ${money(costo)}  (tarifa de este script)`);
    console.log(`\n  Antes de gastar todo: node scripts/polly.mjs --marcas-oraciones --solo ${pedibles[0]?.recurso ?? "lec_ninos_01_1"}`);
    process.exit(0);
  }
  if (!REGIONES_GENERATIVE.has(REGION)) {
    console.error(`La región ${REGION} no tiene motor generativo. Usa us-east-1.`);
    process.exit(1);
  }
  let hechas = 0, gastados = 0, gasto = 0;
  for (const [i, f] of pedibles.entries()) {
    try {
      const r = await generaMarcasOraciones(f);
      hechas++; gastados += r.chars; gasto += r.chars * precioPorCaracter(f);
      process.stdout.write(`\r  ${((i + 1) / pedibles.length * 100).toFixed(1)}%  ${hechas}/${pedibles.length}  ${money(gasto)}  ${f.recurso.padEnd(24)}`);
    } catch (e) {
      console.error(`\n  FALLÓ ${f.recurso}: ${e.message || e}`);
    }
    await dormir(PAUSA_MS);
  }
  console.log(`\n\nmarcas de oración listas ${hechas} · ${gastados} caracteres · ${money(gasto)}`);
  await consolidaMarcasOraciones();
  process.exit(0);
}

const manifiesto = JSON.parse(await readFile(MANIFIESTO, "utf8"));
let filas = manifiesto.filter((f) => f.tipo === "audio");

const grupo = valor("--grupo");
if (grupo) filas = filas.filter((f) => f.grupo === grupo);

const iSolo = args.indexOf("--solo");
if (iSolo >= 0) {
  const ids = new Set(args.slice(iSolo + 1).filter((a) => !a.startsWith("--")));
  filas = filas.filter((f) => ids.has(String(f.recurso)));
}

// Los manuales nunca se piden a Polly: un TTS no pronuncia un fonema suelto.
const manuales = filas.filter((f) => f.manual);
filas = filas.filter((f) => !f.manual);

if (bandera("--marcas")) {
  // Sin --grupo ni --solo, solo el catálogo en inglés; los derivados (lento) y el SSML no llevan marcas.
  const paraMarcas = filas.filter((f) => !f.derivado_de && !f.ssml && (grupo || iSolo >= 0 || f.grupo === GRUPO_MARCAS));
  const faltan = [];
  for (const f of paraMarcas) if (!(await yaEstanMarcas(f))) faltan.push(f);
  const chars = faltan.reduce((t, f) => t + f.texto.length, 0);
  const costo = faltan.reduce((t, f) => t + f.texto.length * precioPorCaracter(f), 0);

  if (bandera("--plan")) {
    console.log(`\nregión ${REGION}` + (REGIONES_GENERATIVE.has(REGION) ? "" : "   ← SIN motor generativo, cámbiala"));
    console.log(`faltan marcas de ${faltan.length} de ${paraMarcas.length} audios`);
    console.log(`  ${String(chars).padStart(6)}  caracteres facturables`);
    console.log(`  costo estimado: ${money(costo)}  (tarifa de este script; las marcas se cobran por carácter como el audio)`);
    console.log(`\n  Antes de gastar todo: node scripts/polly.mjs --marcas --solo ${faltan[0]?.recurso ?? "1"}`);
    process.exit(0);
  }
  if (!REGIONES_GENERATIVE.has(REGION)) {
    console.error(`La región ${REGION} no tiene motor generativo. Usa us-east-1.`);
    process.exit(1);
  }

  const registro = existsSync(REGISTRO) ? JSON.parse(await readFile(REGISTRO, "utf8")) : { fallos: [] };
  let hechas = 0, gastados = 0, gasto = 0;
  for (const [i, f] of faltan.entries()) {
    try {
      const r = await generaMarcas(f);
      hechas++; gastados += r.chars; gasto += r.chars * precioPorCaracter(f);
      process.stdout.write(`\r  ${((i + 1) / faltan.length * 100).toFixed(1)}%  ${hechas}/${faltan.length}  ${money(gasto)}  ${f.archivo.padEnd(28)}`);
    } catch (e) {
      registro.fallos.push({ archivo: f.archivo, error: `marcas: ${String(e.message || e)}` });
      console.error(`\n  FALLÓ ${f.archivo}: ${e.message || e}`);
    }
    await dormir(PAUSA_MS);
  }
  await writeFile(REGISTRO, JSON.stringify(registro, null, 1));
  console.log(`\n\nmarcas listas ${hechas} · ${gastados} caracteres · ${money(gasto)}`);
  await consolidaMarcas();
  process.exit(0);
}

const pendientes = [];
for (const f of filas) if (!(await yaEsta(path.join(RAIZ, "assets", f.archivo)))) pendientes.push(f);

if (bandera("--plan") || (!bandera("--todo") && !grupo && iSolo < 0 && !bandera("--revisa"))) {
  const porGrupo = {};
  let chars = 0;
  let costo = 0;
  for (const f of pendientes) {
    const g = (porGrupo[f.grupo] ||= { n: 0, chars: 0, costo: 0 });
    const propioChars = f.derivado_de ? 0 : f.texto.length;
    const propioCosto = propioChars * precioPorCaracter(f);
    g.n++; g.chars += propioChars; g.costo += propioCosto;
    chars += propioChars; costo += propioCosto;
  }
  console.log(`\nregión ${REGION}` +
    (REGIONES_GENERATIVE.has(REGION) ? "" : "   ← SIN motor generativo, cámbiala"));
  console.log(`faltan ${pendientes.length} de ${filas.length} audios\n`);
  for (const [g, v] of Object.entries(porGrupo).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${String(v.n).padStart(5)}  ${g.padEnd(30)} ${money(v.costo)}`);
  }
  console.log(`\n  ${String(chars).padStart(5)}  caracteres facturables`);
  console.log(`  costo estimado: ${money(costo)}`);
  if (manuales.length) console.log(`\n  ${manuales.length} audios manuales: no se piden a Polly.`);
  process.exit(0);
}

if (bandera("--revisa")) {
  let ok = 0, chicos = [], sin = [];
  for (const f of filas) {
    const d = path.join(RAIZ, "assets", f.archivo);
    if (!existsSync(d)) { sin.push(f.archivo); continue; }
    const s = await stat(d);
    if (s.size < MIN_BYTES && f.texto.length > 12) chicos.push(`${f.archivo} (${s.size} B)`);
    else ok++;
  }
  console.log(`ok ${ok} · faltan ${sin.length} · sospechosos ${chicos.length}`);
  chicos.slice(0, 20).forEach((c) => console.log("  chico:", c));
  process.exit(chicos.length ? 1 : 0);
}

if (!REGIONES_GENERATIVE.has(REGION)) {
  console.error(`La región ${REGION} no tiene motor generativo. Usa us-east-1.`);
  process.exit(1);
}

// Los derivados van al final: necesitan que su original exista.
pendientes.sort((a, b) => (a.derivado_de ? 1 : 0) - (b.derivado_de ? 1 : 0));

const log = existsSync(REGISTRO) ? JSON.parse(await readFile(REGISTRO, "utf8")) : { fallos: [] };
let hechos = 0, chars = 0, costo = 0;
const t0 = Date.now();

for (const [i, f] of pendientes.entries()) {
  try {
    const r = await genera(f);
    hechos++; chars += r.chars; costo += r.chars * precioPorCaracter(f);
    const pct = ((i + 1) / pendientes.length * 100).toFixed(1);
    process.stdout.write(`\r  ${pct}%  ${hechos}/${pendientes.length}  ${money(costo)}  ${f.archivo.padEnd(28)}`);
  } catch (e) {
    log.fallos.push({ archivo: f.archivo, error: String(e.message || e) });
    console.error(`\n  FALLÓ ${f.archivo}: ${e.message || e}`);
  }
}

await writeFile(REGISTRO, JSON.stringify(log, null, 1));
const min = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\n\nlistos ${hechos} · fallos ${log.fallos.length} · ${chars} caracteres · ${money(costo)} · ${min} min`);
if (log.fallos.length) console.log(`Los fallos quedaron en ${REGISTRO}. Vuelve a lanzar el mismo comando: solo reintenta lo que falta.`);
