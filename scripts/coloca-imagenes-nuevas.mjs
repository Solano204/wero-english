#!/usr/bin/env node
/**
 * Copia imagenes_nuevas/<ARCHIVO> a assets/<ARCHIVO> para cada línea de
 * url_images_final (8).txt. Respeta la ruta exacta (img/wero/..., img/NNN.webp).
 * Copia, no mueve. Los archivos de imagenes_nuevas fuera del manifiesto se ignoran.
 *
 *   node scripts/coloca-imagenes-nuevas.mjs
 */

import { mkdir, copyFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CARPETA_ORIGEN = path.join(RAIZ, '..', 'imagenes_nuevas');
const MANIFIESTO = path.join(RAIZ, '..', 'url_images_final (8).txt');

function parseaLinea(linea) {
  const m = linea.match(/^\s*(\d+)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*$/);
  if (!m) return null;
  return { n: Number(m[1]), archivo: m[2] };
}

const texto = await readFile(MANIFIESTO, 'utf8');
const filas = texto.split(/\r?\n/).map(parseaLinea).filter(Boolean);

let colocadas = 0;
const faltantes = [];
for (const f of filas) {
  const origen = path.join(CARPETA_ORIGEN, f.archivo);
  const existe = await stat(origen).then((s) => s.isFile(), () => false);
  if (!existe) {
    faltantes.push(f);
    continue;
  }
  const destino = path.join(RAIZ, 'assets', f.archivo);
  await mkdir(path.dirname(destino), { recursive: true });
  await copyFile(origen, destino);
  colocadas++;
}

console.log(`colocadas: ${colocadas} de ${filas.length}`);
if (faltantes.length) {
  console.log(`\nFaltan ${faltantes.length} en imagenes_nuevas/:`);
  for (const f of faltantes.slice(0, 20)) console.log(`  ${f.n} -> ${f.archivo}`);
  if (faltantes.length > 20) console.log(`  ...y ${faltantes.length - 20} más`);
}
