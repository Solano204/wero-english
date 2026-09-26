/**
 * Valida que cada ronda de Cázala (contracciones.json → cazala[]) tenga
 * sus 3 reducciones realmente audibles en frase_real, que ningún
 * distractor aparezca, y que reducciones/distractores/opciones cuadren.
 *
 *   npm run check:cazala
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

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

/*
 * Lo puro de la interfaz: dónde cae cada reducción en la frase que suena y a qué forma completa se transforma.
 * cazala.ts solo importa tipos, así que se transpila en memoria y se carga como módulo, sin jest.
 */
const fuente = fs.readFileSync(path.join(process.cwd(), 'src/domain/cazala.ts'), 'utf8');
const js = ts.transpileModule(fuente, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { rangoEnFrase, formaCompleta, reduccionesDe } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
);

let pruebas = 0;
const prueba = (nombre, fn) => {
  fn();
  pruebas++;
  console.log(`  ok  ${nombre}`);
};

prueba('rangoEnFrase: palabra suelta, con puntuación pegada y de varias palabras', () => {
  const frase = "I'm just chillin', talkin' and smokin' all day";
  assert.deepEqual(rangoEnFrase(frase, "chillin'"), [2, 2]);
  assert.deepEqual(rangoEnFrase(frase, "smokin'"), [5, 5]);
  assert.deepEqual(rangoEnFrase('You shoulda known better, did ya even try?', 'did ya'), [4, 5]);
  assert.deepEqual(rangoEnFrase("Y'all workin' 'bout ten hours today?", "'bout"), [2, 2]);
  assert.equal(rangoEnFrase(frase, 'gonna'), null);
});

prueba('formaCompleta: la opción que está en la frase formal, sin partir palabras', () => {
  assert.equal(formaCompleta('I am going to take a lot of stuff', 'going to'), 'going to');
  assert.equal(formaCompleta('I have got to get a little water', 'got to / have got to'), 'have got to');
  assert.equal(formaCompleta('I am out of here', 'am not / is not / are not / have not'), null);
  assert.equal(formaCompleta('This is not a lottery', 'lot of'), null);
  assert.equal(formaCompleta('I do not have anything', null), null);
});

prueba('reduccionesDe: las 20 rondas traen tres reducciones ubicadas, en orden y sin encimarse', () => {
  let conCompleta = 0;
  let conSuena = 0;
  for (const item of contracciones.cazala) {
    const lista = reduccionesDe(item, entradas);
    assert.equal(lista.length, 3, `${item.id}: tres reducciones`);
    const palabras = item.frase_real.trim().split(/\s+/).length;
    let ultimo = -1;
    for (const r of lista) {
      assert.ok(r.rango, `${item.id}: ${r.reducida} no se ubica en frase_real`);
      assert.ok(r.rango[0] > ultimo && r.rango[1] < palabras, `${item.id}: ${r.reducida} se encima o se sale`);
      ultimo = r.rango[1];
      assert.ok(!(r.completa && r.suena), `${item.id}: ${r.reducida} no puede tener forma completa y «suena»`);
      if (r.completa) conCompleta++;
      if (r.suena) conSuena++;
    }
  }
  console.log(`      ${conCompleta} con forma completa, ${conSuena} de «suena», ${60 - conCompleta - conSuena} sin ninguna`);
});

prueba('reduccionesDe: chillin\' se transforma en chilling y gonna en going to', () => {
  const uno = reduccionesDe(contracciones.cazala.find((i) => i.id === 'caza_01'), entradas);
  assert.deepEqual(uno.map((r) => [r.reducida, r.completa]), [
    ["chillin'", 'chilling'],
    ["talkin'", 'talking'],
    ["smokin'", 'smoking'],
  ]);
  const dos = reduccionesDe(contracciones.cazala.find((i) => i.id === 'caza_02'), entradas);
  assert.deepEqual(dos.map((r) => r.completa), ['going to', 'lot of', 'out of']);
  const tres = reduccionesDe(contracciones.cazala.find((i) => i.id === 'caza_03'), entradas);
  assert.deepEqual(tres.map((r) => [r.reducida, r.completa, r.suena]), [
    ['gotta', 'have got to', null],
    ['little', null, 'lirol'],
    ['water', null, 'wader'],
  ]);
});

console.log(`\ncazala (interfaz): ${pruebas} pruebas ok\n`);
