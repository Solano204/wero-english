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
const n = await construirDb(root);
console.log(`${RUTA_DB} generado (${n} entradas, ${(fs.statSync(path.join(root, RUTA_DB)).size / 1024).toFixed(0)} KB)`);
