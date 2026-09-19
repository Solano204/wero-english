#!/usr/bin/env node
/**
 * Genera las 1,803 imágenes de Wero con la API de Gemini (Nano Banana).
 *
 *   node scripts/gemini.mjs --plan            qué falta y cuánto cuesta
 *   node scripts/gemini.mjs --test 1          una sola, para calibrar
 *   node scripts/gemini.mjs --solo 1 2 18     unos ids sueltos
 *   node scripts/gemini.mjs --grupo "Catálogo imágenes"
 *   node scripts/gemini.mjs --todo            todo lo que falte
 *   node scripts/gemini.mjs --revisa          valida lo generado
 *
 * Reanudable de dos formas, por si una falla:
 *   1. si el .webp ya existe y pesa lo suficiente, ni lo intenta
 *   2. .gemini-progreso.json guarda el último archivo hecho, los fallos y
 *      el gasto acumulado. Se lee al arrancar y se escribe tras CADA imagen,
 *      no al final, para que un corte a la mitad no pierda el registro.
 *
 * El personaje se fija con la IMAGEN de referencia, no con el texto. Nano
 * Banana Pro mantiene identidad entre referencias, y eso pesa mucho más que
 * cualquier descripción escrita. Sin la referencia, 1,803 imágenes salen con
 * 1,803 perros distintos.
 */

import { GoogleGenAI } from "@google/genai";
import { mkdir, writeFile, readFile, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ejecuta = promisify(execFile);
const RAIZ = path.resolve(import.meta.dirname, "..");
const MANIFIESTO = path.join(RAIZ, "assets", "medios.json");
const PROGRESO = path.join(RAIZ, ".gemini-progreso.json");
const REFERENCIA = path.join(RAIZ, "assets", "ref", "wero.png");

// Por defecto el modelo del tier GRATIS. Nano Banana Pro no tiene tier
// gratis en la API: 0 peticiones por minuto y 0 por día. El Pro solo se
// activa a mano, cuando ya hay facturación.
const MODELO = process.env.GEMINI_MODEL || "gemini-3.1-flash-image";
const ES_PRO = /pro-image/.test(MODELO);
const USD_IMAGEN = ES_PRO ? 0.039 : 0;   // el flash en tier gratis no cuesta
const MIN_BYTES = 8000;        // un webp más chico que esto salió mal
const PAUSA_MS = 1500;         // la cuota por minuto es lo que te frena
const REINTENTOS = 3;

// Tamaño final por carpeta. La API entrega cuadrado o 16:9; el recorte y el
// reescalado los hace ffmpeg, que es exacto y gratis.
const FORMATO = {
  "img/mundos": { w: 1200, h: 400, aspecto: "16:9" },
  "img/juegos": { w: 1200, h: 400, aspecto: "16:9" },
  "img/fon":    { w: 512,  h: 512, aspecto: "1:1" },
  "img/wero":   { w: 512,  h: 512, aspecto: "1:1" },
};
const POR_DEFECTO = { w: 640, h: 640, aspecto: "1:1" };

const clave = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!clave) {
  console.error("Falta GEMINI_API_KEY. Sácala en https://aistudio.google.com/apikey");
  process.exit(1);
}
const ia = new GoogleGenAI({ apiKey: clave });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (n) => "$" + n.toFixed(2);
const formato = (archivo) => FORMATO[path.dirname(archivo)] || POR_DEFECTO;

async function cargaProgreso() {
  if (!existsSync(PROGRESO)) {
    return { hechas: 0, gasto: 0, ultimo: null, fallos: [], arrancado: new Date().toISOString() };
  }
  return JSON.parse(await readFile(PROGRESO, "utf8"));
}
const guardaProgreso = (p) => writeFile(PROGRESO, JSON.stringify(p, null, 1));

async function yaEsta(destino) {
  if (!existsSync(destino)) return false;
  return (await stat(destino)).size >= MIN_BYTES;
}

/** Saca los bytes de la imagen de la respuesta, venga donde venga. */
function extraeImagen(respuesta) {
  const partes = respuesta?.candidates?.[0]?.content?.parts || [];
  for (const p of partes) {
    const d = p.inlineData || p.inline_data;
    if (d?.data) return Buffer.from(d.data, "base64");
  }
  // Si no vino imagen, casi siempre vino texto explicando por qué.
  const texto = partes.map((p) => p.text).filter(Boolean).join(" ");
  const motivo = respuesta?.candidates?.[0]?.finishReason;
  throw new Error(`sin imagen (finishReason: ${motivo || "?"}) ${texto.slice(0, 180)}`);
}

async function pide(prompt, refB64, aspecto) {
  const partes = [];
  if (refB64) partes.push({ inlineData: { mimeType: "image/png", data: refB64 } });
  partes.push({ text: prompt });

  let ultimo;
  for (let i = 1; i <= REINTENTOS; i++) {
    try {
      const r = await ia.models.generateContent({
        model: MODELO,
        contents: [{ role: "user", parts: partes }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: aspecto },
        },
      });
      return extraeImagen(r);
    } catch (e) {
      ultimo = e;
      const msg = String(e.message || e);
      // 429 y 5xx se reintentan; un bloqueo de seguridad no.
      // Cuota DIARIA agotada: no sirve reintentar, hay que volver mañana.
      if (/per day|daily|PerDay|quota.*day/i.test(msg)) {
        const fin = new Error("CUOTA_DIARIA");
        fin.diaria = true;
        throw fin;
      }
      if (!/429|RESOURCE_EXHAUSTED|50\d|UNAVAILABLE|deadline/i.test(msg)) throw e;
      await dormir(4000 * i);
    }
  }
  throw ultimo;
}

async function genera(fila, refB64) {
  const destino = path.join(RAIZ, "assets", fila.archivo);
  const bruto = destino.replace(/\.webp$/, ".png");
  await mkdir(path.dirname(destino), { recursive: true });

  const f = formato(fila.archivo);
  const png = await pide(fila.texto, refB64, f.aspecto);
  await writeFile(bruto, png);

  // Recorta al centro y reescala al tamaño exacto que espera la app.
  await ejecuta("ffmpeg", ["-y", "-loglevel", "error", "-i", bruto,
    "-vf", `scale=${f.w}:${f.h}:force_original_aspect_ratio=increase,crop=${f.w}:${f.h}`,
    "-quality", "80", destino]);
  await unlink(bruto).catch(() => {});

  const tam = (await stat(destino)).size;
  if (tam < MIN_BYTES) throw new Error(`salió de ${tam} bytes, sospechoso`);
  return tam;
}

// ── entrada ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const bandera = (n) => args.includes(n);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

let filas = JSON.parse(await readFile(MANIFIESTO, "utf8")).filter((f) => f.tipo === "imagen");
const grupo = valor("--grupo");
if (grupo) filas = filas.filter((f) => f.grupo === grupo);

for (const n of ["--solo", "--test"]) {
  const i = args.indexOf(n);
  if (i < 0) continue;
  const ids = new Set(args.slice(i + 1).filter((a) => !a.startsWith("--")));
  filas = filas.filter((f) => ids.has(String(f.recurso)));
  if (n === "--test") filas = filas.slice(0, 1);
}

const pendientes = [];
for (const f of filas) if (!(await yaEsta(path.join(RAIZ, "assets", f.archivo)))) pendientes.push(f);

if (bandera("--plan")) {
  const g = {};
  for (const f of pendientes) g[f.grupo] = (g[f.grupo] || 0) + 1;
  const p = await cargaProgreso();
  console.log(`\nmodelo ${MODELO}${ES_PRO ? "  (DE PAGO)" : "  (tier gratis)"}`);
  console.log(`referencia ${existsSync(REFERENCIA) ? "ok" : "FALTA assets/ref/wero.png"}`);
  console.log(`faltan ${pendientes.length} de ${filas.length} imágenes\n`);
  for (const [k, v] of Object.entries(g).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(5)}  ${k.padEnd(30)} ${money(v * USD_IMAGEN)}`);
  }
  console.log(ES_PRO
    ? `\n  costo estimado: ${money(pendientes.length * USD_IMAGEN)}`
    : `\n  costo: $0.00 en el tier gratis, limitado por cuota diaria.`);
  if (p.hechas) console.log(`  ya llevabas ${p.hechas} hechas, ${money(p.gasto)} gastados, última: ${p.ultimo}`);
  process.exit(0);
}

if (bandera("--revisa")) {
  let ok = 0; const chicos = [], sin = [];
  for (const f of filas) {
    const d = path.join(RAIZ, "assets", f.archivo);
    if (!existsSync(d)) { sin.push(f.archivo); continue; }
    if ((await stat(d)).size < MIN_BYTES) chicos.push(f.archivo); else ok++;
  }
  console.log(`ok ${ok} · faltan ${sin.length} · sospechosas ${chicos.length}`);
  chicos.slice(0, 20).forEach((c) => console.log("  chica:", c));
  process.exit(chicos.length ? 1 : 0);
}

if (!existsSync(REFERENCIA)) {
  console.error("Falta assets/ref/wero.png — es la referencia del personaje.");
  console.error("Sin ella cada imagen sale con un perro distinto. Ponla y vuelve a lanzar.");
  process.exit(1);
}
const refB64 = (await readFile(REFERENCIA)).toString("base64");

const progreso = await cargaProgreso();
console.log(`referencia cargada · ${pendientes.length} por generar`);
if (progreso.hechas) console.log(`retomando: llevabas ${progreso.hechas}, última ${progreso.ultimo}\n`);

const t0 = Date.now();
let sesion = 0;

for (const [i, f] of pendientes.entries()) {
  try {
    await genera(f, refB64);
    sesion++;
    progreso.hechas++;
    progreso.gasto += USD_IMAGEN;
    progreso.ultimo = f.archivo;
    progreso.fallos = progreso.fallos.filter((x) => x.archivo !== f.archivo);
  } catch (e) {
    if (e.diaria) {
      await guardaProgreso(progreso);
      console.log(`\n\nSe acabó la cuota gratis de hoy. Llevas ${progreso.hechas} de ${filas.length}.`);
      console.log("Vuelve mañana y relanza el MISMO comando: retoma donde se quedó.");
      console.log("La cuota diaria de la API se reinicia a medianoche.");
      break;
    }
    progreso.fallos.push({ archivo: f.archivo, error: String(e.message || e).slice(0, 200) });
    console.error(`\n  FALLÓ ${f.archivo}: ${String(e.message || e).slice(0, 160)}`);
  }
  // Se guarda tras cada imagen: si se corta la luz, no se pierde el registro.
  await guardaProgreso(progreso);
  const pct = ((i + 1) / pendientes.length * 100).toFixed(1);
  process.stdout.write(`\r  ${pct}%  ${sesion}/${pendientes.length}  ${money(progreso.gasto)}  ${f.archivo.padEnd(26)}`);
  await dormir(PAUSA_MS);
}

const min = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\n\nesta sesión ${sesion} · acumulado ${progreso.hechas} · fallos ${progreso.fallos.length} · ${money(progreso.gasto)} · ${min} min`);
if (progreso.fallos.length) {
  console.log(`Fallos en ${PROGRESO}. Relanza el mismo comando: solo reintenta lo que falta.`);
}
