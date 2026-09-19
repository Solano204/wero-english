#!/usr/bin/env node
/**
 * Dónde vas y qué sigue.
 *
 *   node scripts/avance.mjs         resumen y el siguiente pendiente
 *   node scripts/avance.mjs --n 30  enseña los siguientes 30 nombres
 */

import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const orden = JSON.parse(await readFile(path.join(RAIZ, "assets", "orden.json"), "utf8"));
const MIN = 8000;

const args = process.argv.slice(2);
const i = args.indexOf("--n");
const cuantos = i >= 0 ? parseInt(args[i + 1], 10) : 0;

const hechas = [], faltan = [], chicas = [];
for (const o of orden) {
  const p = path.join(RAIZ, "assets", o.archivo);
  if (!existsSync(p)) { faltan.push(o); continue; }
  if (statSync(p).size < MIN) chicas.push(o); else hechas.push(o);
}

const porGrupo = {};
for (const o of orden) {
  const g = (porGrupo[o.grupo] ||= { total: 0, hechas: 0 });
  g.total++;
  if (existsSync(path.join(RAIZ, "assets", o.archivo))) g.hechas++;
}

const pct = (hechas.length / orden.length * 100).toFixed(1);
const barra = "█".repeat(Math.round(pct / 2.5)).padEnd(40, "░");

console.log(`\n  ${barra}  ${pct}%`);
console.log(`  ${hechas.length} de ${orden.length} · faltan ${faltan.length}\n`);

for (const [g, v] of Object.entries(porGrupo)) {
  const marca = v.hechas === v.total ? "listo" : `${v.hechas}/${v.total}`;
  console.log(`  ${g.padEnd(28)} ${marca}`);
}

if (chicas.length) {
  console.log(`\n  ${chicas.length} sospechosas, pesan menos de 8 KB:`);
  chicas.slice(0, 10).forEach((c) => console.log(`    ${c.n}  ${c.archivo}`));
  console.log("  Bórralas y vuelve a generarlas.");
}

if (!faltan.length) {
  console.log("\n  Ya están todas. Corre:  npm run build:assets\n");
} else {
  const sig = faltan[0];
  console.log(`\n  SIGUIENTE: número ${sig.n} · ${sig.archivo}`);
  console.log(`  Busca en prompts.txt:  === ${sig.n} / ${orden.length} ===`);
  const dias = Math.ceil(faltan.length / 300);
  console.log(`  A 300 al día te quedan ${dias} día${dias === 1 ? "" : "s"}.\n`);
  if (cuantos) {
    console.log(`  Los siguientes ${cuantos}:`);
    faltan.slice(0, cuantos).forEach((f) => console.log(`    ${String(f.n).padStart(4)}  ${f.archivo}`));
    console.log();
  }
}
