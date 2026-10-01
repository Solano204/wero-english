/**
 * Escribe los derivados de assets/data (ver scripts/lib/derivados.mjs):
 *     npm run build:derivados
 */
import fs from 'node:fs';
import path from 'node:path';
import { RUTA_CAZALA, RUTA_DB, RUTA_RESUMEN, construirDb, textoCazala, textoResumen } from './lib/derivados.mjs';

const root = process.cwd();
fs.writeFileSync(path.join(root, RUTA_RESUMEN), textoResumen(root), 'utf8');
console.log(`${RUTA_RESUMEN} generado`);
fs.writeFileSync(path.join(root, RUTA_CAZALA), textoCazala(root), 'utf8');
console.log(`${RUTA_CAZALA} generado`);
const { entradas, reusada } = await construirDb(root);
const kb = (fs.statSync(path.join(root, RUTA_DB)).size / 1024).toFixed(0);
console.log(
  reusada
    ? `${RUTA_DB} al día (${entradas} entradas, ${kb} KB): catalogo.json no cambió, se usa la de Git (Node ${process.versions.node} no tiene node:sqlite)`
    : `${RUTA_DB} generado (${entradas} entradas, ${kb} KB)`,
);
