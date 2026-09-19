#!/usr/bin/env node
/**
 * Toma lo que haya en imagenes_nuevas/ (una carpeta arriba de wero-app,
 * llenada a mano siguiendo imagenes_nuevas/LEEME.txt) y lo coloca en su
 * ruta final dentro de assets/, según url_images.txt.
 *
 * Empareja por NOMBRE DE ARCHIVO exacto (los 394 nombres del manifiesto
 * son únicos, ya se verificó). Copia, no mueve: así una segunda pasada
 * no pierde nada si algo salió mal.
 *
 *   node scripts/coloca-imagenes-nuevas.mjs
 */

import { mkdir, copyFile, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CARPETA_ORIGEN = path.join(RAIZ, '..', 'imagenes_nuevas');
const MANIFIESTO = path.join(RAIZ, '..', 'url_images.txt');

function parseaLinea(linea) {
  const m = linea.match(/^\s*(\d+)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*$/);
  if (!m) return null;
  return { n: Number(m[1]), archivo: m[2] };
}

const texto = await readFile(MANIFIESTO, 'utf8');
const filas = texto.split('\n').map(parseaLinea).filter(Boolean);

// nombre de archivo -> ruta destino relativa (assets/img/...)
const porNombre = new Map(filas.map((f) => [path.basename(f.archivo), f.archivo]));

const presentes = (await readdir(CARPETA_ORIGEN)).filter((n) => !n.startsWith('.') && n !== 'LEEME.txt');

let colocadas = 0;
const sinReconocer = [];
for (const nombre of presentes) {
  const destinoRel = porNombre.get(nombre);
  if (!destinoRel) {
    sinReconocer.push(nombre);
    continue;
  }
  const origen = path.join(CARPETA_ORIGEN, nombre);
  if ((await stat(origen)).isDirectory()) continue;

  const destino = path.join(RAIZ, 'assets', destinoRel);
  await mkdir(path.dirname(destino), { recursive: true });
  await copyFile(origen, destino);
  colocadas++;
}

const faltantes = filas.filter((f) => !presentes.includes(path.basename(f.archivo)));

console.log(`colocadas: ${colocadas} de ${filas.length}`);
if (sinReconocer.length) {
  console.log(`\nArchivos en imagenes_nuevas/ que no están en el manifiesto (revisa el nombre):`);
  for (const n of sinReconocer) console.log(`  ${n}`);
}
if (faltantes.length) {
  console.log(`\nTodavía faltan ${faltantes.length}:`);
  for (const f of faltantes.slice(0, 20)) console.log(`  ${f.n} -> ${path.basename(f.archivo)}`);
  if (faltantes.length > 20) console.log(`  ...y ${faltantes.length - 20} más`);
}
