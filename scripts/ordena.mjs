#!/usr/bin/env node
/**
 * Ordena las imágenes que bajaste de Gemini.
 *
 *   node scripts/ordena.mjs --ver        qué haría, sin tocar nada
 *   node scripts/ordena.mjs              procesa hasta 20 y pide confirmación
 *   node scripts/ordena.mjs --lote 50    cambia el tamaño del lote
 *   node scripts/ordena.mjs --si         aplica sin preguntar
 *   node scripts/ordena.mjs --desde 45   empieza en ese número del orden
 *   node scripts/ordena.mjs --deshacer   revierte el último lote
 *
 * IMPORTANTE, porque de esto depende todo: el script NO mira la imagen. No
 * sabe qué hay dentro. Empareja por POSICIÓN — la más vieja va al primer
 * pendiente, la segunda al segundo, y así. Si te saltas una al descargar,
 * todo lo que sigue se recorre un lugar.
 *
 * Por eso: genera y descarga UNA a la vez, en el orden de prompts.txt, y
 * procesa por lotes chicos. Si algo se descuadra pierdes 20, no 1,803.
 */

import { readdir, stat, mkdir, rename, readFile, writeFile, open, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ejecuta = promisify(execFile);
const RAIZ = path.resolve(import.meta.dirname, "..");
const ORDEN = path.join(RAIZ, "assets", "orden.json");
const USADAS = path.join(RAIZ, "assets", "_usadas");
const ULTIMO = path.join(RAIZ, ".ultimo-lote.json");
const MARCA = path.join(RAIZ, ".ordena-marca");

const DESCARGAS = process.env.WERO_DESCARGAS
  || path.join(os.homedir(), "Downloads", "IMAGES_ENGLISH");

const EXT = /\.(png|jpg|jpeg|webp)$/i;
const LOTE_POR_DEFECTO = 20;

const FORMATO = {
  "img/mundos": { w: 1200, h: 400 },
  "img/juegos": { w: 1200, h: 400 },
  "img/fon": { w: 512, h: 512 },
  "img/wero": { w: 512, h: 512 },
};
const POR_DEFECTO = { w: 640, h: 640 };

const args = process.argv.slice(2);
const bandera = (n) => args.includes(n);
const num = (n, d) => { const i = args.indexOf(n); return i >= 0 ? parseInt(args[i + 1], 10) : d; };

// ── deshacer el último lote ──────────────────────────────────────────────
if (bandera("--deshacer")) {
  if (!existsSync(ULTIMO)) { console.log("No hay lote que deshacer."); process.exit(0); }
  const lote = JSON.parse(await readFile(ULTIMO, "utf8"));
  let n = 0;
  for (const m of lote.movimientos) {
    try {
      await rename(m.guardado, m.origen);
      await unlink(m.destino).catch(() => {});
      n++;
    } catch { console.error(`  no pude revertir ${m.destino}`); }
  }
  await writeFile(ULTIMO, JSON.stringify({ movimientos: [] }, null, 1));
  console.log(`${n} revertidas. Volvieron a ${DESCARGAS}`);
  process.exit(0);
}

// ── que sea imagen de verdad, no solo la extensión ───────────────────────
const FIRMAS = [
  [0x89, 0x50, 0x4e, 0x47],   // png
  [0xff, 0xd8, 0xff],          // jpg
  [0x52, 0x49, 0x46, 0x46],    // webp (RIFF)
];
async function esImagen(ruta) {
  const fh = await open(ruta, "r");
  const buf = Buffer.alloc(12);
  await fh.read(buf, 0, 12, 0);
  await fh.close();
  return FIRMAS.some((f) => f.every((v, i) => buf[i] === v));
}

// ── marca de tiempo: lo anterior al último lote se ignora ────────────────
const corte = existsSync(MARCA) ? (await stat(MARCA)).mtimeMs : 0;

const orden = JSON.parse(await readFile(ORDEN, "utf8"));

let cursor;
const desde = num("--desde", null);
if (desde) {
  cursor = orden.findIndex((o) => o.n === desde);
  if (cursor < 0) { console.error(`No existe el número ${desde}.`); process.exit(1); }
} else {
  cursor = orden.findIndex((o) => !existsSync(path.join(RAIZ, "assets", o.archivo)));
  if (cursor < 0) { console.log("Ya están las 1,803."); process.exit(0); }
}

if (!existsSync(DESCARGAS)) {
  console.error(`No existe la carpeta ${DESCARGAS}`);
  console.error("Créala y apunta ahí las descargas de Chrome, o usa:");
  console.error("  export WERO_DESCARGAS=/ruta/a/tu/carpeta");
  process.exit(1);
}

// ── candidatos ───────────────────────────────────────────────────────────
const candidatos = [], descartados = [];
for (const n of await readdir(DESCARGAS)) {
  const p = path.join(DESCARGAS, n);
  if (!EXT.test(n)) continue;
  const s = await stat(p);
  if (!s.isFile()) continue;
  if (s.size < 5000) { descartados.push([n, "pesa menos de 5 KB"]); continue; }
  if (corte && s.mtimeMs < corte) { descartados.push([n, "anterior al último lote"]); continue; }
  if (!(await esImagen(p))) { descartados.push([n, "no es una imagen"]); continue; }
  candidatos.push({ ruta: p, nombre: n, t: s.mtimeMs });
}
candidatos.sort((a, b) => a.t - b.t);

if (descartados.length) {
  console.log(`\n${descartados.length} descartados:`);
  descartados.slice(0, 8).forEach(([n, r]) => console.log(`  ${n.slice(0, 40).padEnd(40)} ${r}`));
  if (descartados.length > 8) console.log(`  ...y ${descartados.length - 8} más`);
}

if (!candidatos.length) {
  console.log(`\nNo hay imágenes nuevas en ${DESCARGAS}`);
  process.exit(0);
}

const tam = bandera("--ver") ? candidatos.length : num("--lote", LOTE_POR_DEFECTO);
const trabajo = candidatos.slice(0, tam);

console.log(`\ncarpeta   ${DESCARGAS}`);
console.log(`nuevas    ${candidatos.length}`);
console.log(`este lote ${trabajo.length}`);
console.log(`empieza   número ${orden[cursor].n} · ${orden[cursor].archivo}\n`);
console.log("  El emparejamiento es por ORDEN DE DESCARGA, no por contenido.");
console.log("  Revísalo antes de aceptar.\n");

const plan = [];
for (const [i, c] of trabajo.entries()) {
  const d = orden[cursor + i];
  if (!d) break;
  const f = FORMATO[path.dirname(d.archivo)] || POR_DEFECTO;
  plan.push({ c, d, f });
  console.log(`  ${String(d.n).padStart(4)}  ${c.nombre.slice(0, 36).padEnd(36)} -> ${d.archivo.padEnd(24)} ${f.w}x${f.h}`);
}

if (bandera("--ver")) {
  console.log("\nSolo vista previa. Quita --ver para aplicarlo.");
  process.exit(0);
}

if (!bandera("--si")) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(`\n¿Aplico estas ${plan.length}? (si/no) `)).trim().toLowerCase();
  rl.close();
  if (r !== "si" && r !== "s") { console.log("Cancelado. No se tocó nada."); process.exit(0); }
}

await mkdir(USADAS, { recursive: true });
const movimientos = [];
let hechas = 0;

for (const { c, d, f } of plan) {
  const salida = path.join(RAIZ, "assets", d.archivo);
  const guardado = path.join(USADAS, `${String(d.n).padStart(4, "0")}_${c.nombre}`);
  try {
    await mkdir(path.dirname(salida), { recursive: true });
    await ejecuta("ffmpeg", ["-y", "-loglevel", "error", "-i", c.ruta,
      "-vf", `scale=${f.w}:${f.h}:force_original_aspect_ratio=increase,crop=${f.w}:${f.h}`,
      "-quality", "80", salida]);
    await rename(c.ruta, guardado);
    movimientos.push({ origen: c.ruta, guardado, destino: salida, n: d.n });
    hechas++;
  } catch (e) {
    console.error(`  FALLÓ ${d.archivo}: ${String(e.message || e).slice(0, 90)}`);
    break;   // se corta: si una falla, las siguientes se descuadrarían
  }
}

await writeFile(ULTIMO, JSON.stringify({ fecha: new Date().toISOString(), movimientos }, null, 1));
await writeFile(MARCA, String(Date.now()));

console.log(`\n${hechas} ordenadas. Originales en assets/_usadas/`);
console.log("Si algo quedó mal:  node scripts/ordena.mjs --deshacer");
console.log("Siguiente:          node scripts/avance.mjs");
