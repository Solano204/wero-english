/**
 * Escribe src/data/resumenContenido.ts (ver scripts/lib/resumenContenido.mjs).
 *     npm run build:resumen
 */
import fs from 'node:fs';
import path from 'node:path';
import { RUTA_RESUMEN, textoResumen } from './lib/resumenContenido.mjs';

fs.writeFileSync(path.join(process.cwd(), RUTA_RESUMEN), textoResumen(), 'utf8');
console.log(`${RUTA_RESUMEN} generado`);
