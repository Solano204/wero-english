/**
 * Mezcla el phrasal_verbs.json real con GRUPOS_NUEVOS (Paso 1,
 * propuesta) y escribe el resultado en un archivo TEMPORAL para
 * validar antes de guardar encima del real.
 */
import fs from 'node:fs';
import { GRUPOS_NUEVOS } from './.tmp-phrasal-nuevos.mjs';

const PATH_REAL = 'assets/data/phrasal_verbs.json';
const PATH_PROPUESTA = '.tmp-phrasal-propuesta.json';

const data = JSON.parse(fs.readFileSync(PATH_REAL, 'utf8'));

let siguienteId = Math.max(...data.verbos.map((v) => v.id)) + 1;
const gruposPorVerbo = new Map(data.grupos.map((g) => [g.verbo, g]));

let agregados = 0;
for (const { verbo, entradas } of GRUPOS_NUEVOS) {
  for (const e of entradas) {
    const id = siguienteId++;
    data.verbos.push({
      id,
      verbo,
      particula: e.particula,
      frase: `${verbo} ${e.particula}`,
      significado: e.significado,
      ejemplo: e.ejemplo,
      traduccion: e.traduccion,
      vulgaridad: 0,
      separable: e.separable,
      nota: e.nota,
    });
    agregados++;

    const grupo = gruposPorVerbo.get(verbo);
    if (grupo) {
      grupo.ids.push(id);
      grupo.cuantos = grupo.ids.length;
    } else {
      const nuevo = { verbo, cuantos: 1, ids: [id] };
      data.grupos.push(nuevo);
      gruposPorVerbo.set(verbo, nuevo);
    }
  }
}

data.total = data.verbos.length;

fs.writeFileSync(PATH_PROPUESTA, JSON.stringify(data, null, 1), 'utf8');
console.log(`Propuesta escrita en ${PATH_PROPUESTA}`);
console.log(`${agregados} entradas nuevas, total ${data.total}, ${data.grupos.length} verbos`);
