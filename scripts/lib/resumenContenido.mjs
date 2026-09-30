/**
 * El texto de src/data/resumenContenido.ts: los datos chicos que la app necesita al abrir y que antes salían de
 * evaluar un JSON grande. Lo escribe scripts/build-resumen.mjs y lo revisa check:data (tiene que coincidir con los
 * JSON de assets/data).
 */
import fs from 'node:fs';
import path from 'node:path';

const leer = (root, nombre) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'assets/data', nombre), 'utf8'));
  } catch {
    return null;
  }
};

export const RUTA_RESUMEN = 'src/data/resumenContenido.ts';

export function textoResumen(root = process.cwd()) {
  const phrasal = leer(root, 'phrasal_verbs.json');
  const verbos = Array.isArray(phrasal?.verbos) ? phrasal.verbos.length : 0;
  return `// GENERADO POR scripts/build-resumen.mjs — NO EDITAR A MANO
// Corre "npm run build:resumen" después de cambiar los JSON de assets/data (check:data avisa si quedó viejo).

/** Cuántos phrasal verbs trae phrasal_verbs.json: el dato del renglón de Phrasal en Practicar, sin cargar el JSON. */
export const PHRASAL_VERBOS = ${verbos};
`;
}
