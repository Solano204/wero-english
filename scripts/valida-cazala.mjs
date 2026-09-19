/**
 * Valida que cada ronda de Cázala (contracciones.json → cazala[]) tenga
 * sus 3 reducciones realmente audibles en frase_real, que ningún
 * distractor aparezca, y que reducciones/distractores/opciones cuadren.
 *
 *   npm run check:cazala
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA = path.join(process.cwd(), 'assets/data');
const catalogo = JSON.parse(fs.readFileSync(path.join(DATA, 'catalogo.json'), 'utf8'));
const contracciones = JSON.parse(
  fs.readFileSync(path.join(DATA, 'contracciones.json'), 'utf8')
);
const entradas = new Map(catalogo.entries.map((e) => [e.id, e]));

/**
 * Reimplementación en JS plano de `erroresCazalaItem` en
 * src/domain/cazala.ts (los scripts de este repo no compilan TypeScript,
 * así que no se puede importar ese archivo directamente). Debe quedar
 * igual: mismo campo (`phrase_tts`), mismo caso especial de "aave".
 */
function normaliza(s) {
  return s.toLowerCase().replace(/[’‘]/g, "'").trim();
}

const filas = [];

for (const item of contracciones.cazala) {
  const errores = [];
  const frase = normaliza(item.frase_real);

  if (item.reducciones.length !== 3) errores.push('no tiene 3 reducciones');
  if (item.distractores.length !== 3) errores.push('no tiene 3 distractores');

  const todas = [...item.reducciones, ...item.distractores];
  if (new Set(todas).size !== todas.length) {
    errores.push('reducciones y distractores tienen ids repetidos');
  }
  const esperadas = [...todas].sort((a, b) => a - b);
  const actuales = [...item.opciones].sort((a, b) => a - b);
  if (JSON.stringify(esperadas) !== JSON.stringify(actuales)) {
    errores.push('opciones no es exactamente reducciones ∪ distractores');
  }

  for (const id of item.reducciones) {
    const e = entradas.get(id);
    if (!e) {
      errores.push(`reducción ${id} no existe en el catálogo`);
      continue;
    }
    if (e.regla_grupo === 'aave') {
      errores.push(
        `reducción ${id} (${e.phrase_tts}) es una regla gramatical, no se puede cazar`
      );
      continue;
    }
    if (!frase.includes(normaliza(e.phrase_tts))) {
      errores.push(`reducción ${id} (${e.phrase_tts}) no aparece en frase_real`);
    }
  }

  for (const id of item.distractores) {
    const e = entradas.get(id);
    if (!e) {
      errores.push(`distractor ${id} no existe en el catálogo`);
      continue;
    }
    if (frase.includes(normaliza(e.phrase_tts))) {
      errores.push(`distractor ${id} (${e.phrase_tts}) sí aparece en frase_real`);
    }
  }

  if (errores.length) filas.push({ id: item.id, errores });
}

console.log(`\nCÁZALA: ${contracciones.cazala.length - filas.length} de ${contracciones.cazala.length} rondas OK\n`);

if (filas.length) {
  for (const f of filas) {
    console.log(`  ${f.id}`);
    for (const e of f.errores) console.log(`    - ${e}`);
  }
  console.log('');
  process.exit(1);
}
