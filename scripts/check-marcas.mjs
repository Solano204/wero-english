/**
 * Prueba los tiempos de palabra del karaoke de Estudio.
 *
 *   npm run check:marcas
 *
 * marcas.ts no importa nada de React Native, así que se transpila en memoria
 * con typescript y se carga como módulo, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const fuente = fs.readFileSync(path.join(ROOT, 'src/domain/marcas.ts'), 'utf8');
const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const M = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const { silabas, estimar, alinear, desdeMarcas, duracionDeMarcas, analizar, trocear, duracionEstimada, ENTRADA_S, SALIDA_S, ENV_HZ } = M;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};
const cerca = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} no está cerca de ${b}`);
const finito = (x) => Number.isFinite(x.inicio) && Number.isFinite(x.sig ?? x.fin);

prueba('sílabas de palabras comunes', () => {
  const esperadas = { make: 1, table: 2, wanted: 2, played: 1, "I'm": 1, because: 2, beautiful: 3, gonna: 2, bro: 1, the: 1, watches: 2 };
  for (const [p, s] of Object.entries(esperadas)) assert.equal(silabas(p), s, p);
  assert.equal(silabas('—'), 0.5, 'un símbolo vale media sílaba');
  assert.ok(silabas('220') >= 1, 'un número cuenta');
});

prueba('estimar: en orden, dentro del audio y proporcional a las sílabas', () => {
  const t = estimar(['I', 'wanted', 'chocolate'], 3);
  assert.equal(t.length, 3);
  assert.ok(t[0].inicio >= ENTRADA_S - 1e-9, 'no empieza antes del silencio inicial');
  assert.ok(t[2].fin <= 3 - SALIDA_S + 1e-9, 'no termina después del silencio final');
  for (let i = 1; i < t.length; i++) assert.ok(t[i].inicio >= t[i - 1].fin - 1e-9, 'sin solaparse');
  assert.ok(t[2].fin - t[2].inicio > t[1].fin - t[1].inicio, 'más sílabas, más tiempo');
});

prueba('estimar: la pausa de una coma desplaza a las siguientes', () => {
  const sin = estimar(['well', 'we', 'go'], 2);
  const con = estimar(['well,', 'we', 'go'], 2);
  assert.ok(con[1].inicio > sin[1].inicio, 'tras la coma la siguiente empieza más tarde');
  cerca(con[2].fin, sin[2].fin);
});

prueba('estimar: nunca falla con entradas raras', () => {
  assert.deepEqual(estimar([], 2), []);
  for (const dur of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.05]) {
    for (const x of estimar(['a', '...', '&'], dur)) assert.ok(finito(x) && x.fin >= x.inicio, `dur ${dur}`);
  }
  assert.ok(duracionEstimada(['one', 'two']) > ENTRADA_S + SALIDA_S);
});

prueba('alinear: idéntico, con una nota de más y sin nada en común', () => {
  assert.deepEqual(alinear(['a', 'b', 'c'], ['a', 'b', 'c']), [0, 1, 2]);
  const vistas = ['Are', 'we', 'go', 'slop,', 'bro?', '(Are', 'we', 'gonna', 'slop,', 'bro?)'];
  const dichas = ['Are', 'we', 'gonna', 'slop,', 'bro?'];
  assert.deepEqual(alinear(vistas, dichas), [0, 1, 2, 3, 4, -1, -1, -1, -1, -1], '"go" cuenta como "gonna" y la nota queda fuera');
  assert.deepEqual(alinear(['x', 'y'], ['a', 'b']), [-1, -1]);
  assert.deepEqual(alinear(["don't", 'go'], ['dont', 'GO']), [0, 1], 'sin apóstrofo ni mayúsculas');
  assert.deepEqual(alinear(['-', 'a'], ['-', 'a']), [-1, 1], 'un símbolo suelto no se alinea');
});

prueba('desdeMarcas: usa las marcas y las reescala a la duración real', () => {
  const marcas = { d: 2000, m: [[100, 'we'], [500, 'gonna'], [1100, 'slop']] };
  const t = desdeMarcas(['we', 'gonna', 'slop'], marcas, 4);
  assert.ok(t);
  cerca(t[0].inicio, 0.2);
  cerca(t[1].inicio, 1.0);
  cerca(t[2].inicio, 2.2);
  cerca(desdeMarcas(['we', 'gonna', 'slop'], marcas, 2)[1].inicio, 0.5);
});

prueba('desdeMarcas: sin `d` deduce la duración y solo reescala si el ritmo es otro', () => {
  const marcas = { m: [[100, 'we'], [600, 'gonna'], [1100, 'slop']] };
  const dm = duracionDeMarcas(marcas);
  cerca(dm, 1.1 + 1 * (1.0 / 3) + SALIDA_S, 1e-9);
  cerca(desdeMarcas(['we', 'gonna', 'slop'], marcas, dm * 1.05)[1].inicio, 0.6, 1e-9);
  cerca(desdeMarcas(['we', 'gonna', 'slop'], marcas, dm * 2)[1].inicio, 1.2, 1e-9);
  assert.equal(duracionDeMarcas({ m: [] }), 0);
});

prueba('desdeMarcas: reparte las palabras sin marca (al medio, al inicio y al final)', () => {
  const medio = desdeMarcas(['a', 'b', 'c', 'd', 'e'], { d: 2000, m: [[200, 'a'], [600, 'b'], [1400, 'd'], [1800, 'e']] }, 2);
  cerca(medio[2].inicio, 1.0);
  const inicio = desdeMarcas(['x', 'a', 'b', 'c'], { d: 2000, m: [[500, 'a'], [900, 'b'], [1300, 'c']] }, 2);
  cerca(inicio[0].inicio, ENTRADA_S);
  const final = desdeMarcas(['a', 'b', 'c', 'z'], { d: 2000, m: [[200, 'a'], [600, 'b'], [1000, 'c']] }, 2);
  cerca(final[3].inicio, (1.0 + (2 - SALIDA_S)) / 2);
});

prueba('desdeMarcas: desconfía de marcas que no son de esta frase', () => {
  assert.equal(desdeMarcas(['a', 'b', 'c'], { m: [[0, 'x'], [100, 'y']] }, 2), null);
  assert.equal(desdeMarcas(['a', 'b', 'c', 'd'], { m: [[0, 'a'], [100, 'b']] }, 2), null, '50% no alcanza');
  assert.equal(desdeMarcas([], { m: [] }, 2), null);
});

prueba('analizar: la frase que se ve es la que se dice', () => {
  const marcas = { d: 2000, m: [[100, 'Are'], [400, 'we'], [700, 'gonna'], [1100, 'slop,'], [1500, 'bro?']] };
  const { palabras } = analizar('Are we gonna slop, bro?', 'Are we gonna slop, bro?', marcas, 2);
  assert.equal(palabras.length, 5);
  assert.ok(palabras.every((p) => p.hablada));
  for (let i = 0; i < 4; i++) cerca(palabras[i].sig, palabras[i + 1].inicio);
  cerca(palabras[4].sig, 2 - SALIDA_S);
  cerca(palabras[2].inicio, 0.7);
});

prueba('analizar: la nota entre paréntesis no se dice y no se ilumina', () => {
  const { palabras } = analizar('Are we go slop, bro? (Are we gonna slop, bro?)', 'Are we gonna slop, bro?', undefined, 2);
  assert.equal(palabras.length, 10);
  assert.deepEqual(palabras.map((p) => p.hablada), [true, true, true, true, true, false, false, false, false, false]);
  const dichas = palabras.filter((p) => p.hablada);
  for (let i = 1; i < dichas.length; i++) assert.ok(dichas[i].inicio > dichas[i - 1].inicio, 'en orden');
  for (const p of dichas) assert.ok(p.sig > p.inicio, 'cada ventana tiene largo');
});

prueba('analizar: si lo que se ve no se parece a lo que se dice, estima sobre lo que se ve', () => {
  const { palabras } = analizar('Buy some mosquitoes', 'Moscato', undefined, 2);
  assert.equal(palabras.length, 3);
  assert.ok(palabras.every((p) => p.hablada), 'todas hablada: no hay otra referencia');
  assert.ok(palabras[0].inicio < palabras[1].inicio && palabras[1].inicio < palabras[2].inicio);
});

prueba('analizar: envolvente entre 0 y 1, en silencio antes de hablar y con pico dentro de la palabra', () => {
  const { envolvente, palabras } = analizar('Hello everybody', 'Hello everybody', undefined, 2);
  assert.equal(envolvente.length, Math.ceil(2 * ENV_HZ) + 1);
  for (const v of envolvente) assert.ok(v >= 0 && v <= 1, `fuera de rango: ${v}`);
  assert.equal(envolvente[0], 0, 'silencio antes de la primera palabra');
  const p = palabras[1];
  const medio = Math.round(((p.inicio + p.sig) / 2) * ENV_HZ);
  assert.ok(envolvente[medio] > 0.5, 'la voz suena a mitad de la palabra');
});

prueba('analizar: nunca lanza con textos, marcas o duraciones raros', () => {
  const casos = [
    ['', '', undefined, 0],
    ['a', '', undefined, 0],
    ['...', '...', undefined, Number.NaN],
    ['&', 'and', { m: [] }, -3],
    ['hola', 'hola', { m: 'roto' }, 2],
    ['two words', 'two words', { d: 0, m: [[0, 'two'], [5, 'words']] }, Number.POSITIVE_INFINITY],
  ];
  for (const [a, b, c, d] of casos) {
    const r = analizar(a, b, c, d);
    assert.equal(r.palabras.length, trocear(a).length);
    for (const p of r.palabras) assert.ok(finito(p), `${a}|${b}`);
    for (const v of r.envolvente) assert.ok(Number.isFinite(v));
  }
});

// El catálogo real: ninguna frase rompe el análisis y todas tienen algo que iluminar.
const rutaCatalogo = path.join(ROOT, 'assets/data/catalogo.json');
if (fs.existsSync(rutaCatalogo)) {
  const { entries } = JSON.parse(fs.readFileSync(rutaCatalogo, 'utf8'));
  prueba(`catálogo: ${entries.length} frases se analizan sin fallar`, () => {
    let conNota = 0;
    for (const e of entries) {
      const { palabras, envolvente } = analizar(e.phrase, e.phrase_tts, undefined, 0);
      assert.equal(palabras.length, trocear(e.phrase).length, `id ${e.id}`);
      const dichas = palabras.filter((p) => p.hablada);
      assert.ok(dichas.length >= 1, `id ${e.id}: nada que iluminar`);
      if (dichas.length < palabras.length) conNota++;
      for (let i = 0; i < dichas.length; i++) {
        assert.ok(finito(dichas[i]) && dichas[i].sig > dichas[i].inicio, `id ${e.id}`);
        if (i > 0) assert.ok(dichas[i].inicio >= dichas[i - 1].inicio, `id ${e.id}: fuera de orden`);
      }
      assert.ok(envolvente.every((v) => v >= 0 && v <= 1), `id ${e.id}`);
    }
    console.log(`      ${conNota} frases (${((conNota / entries.length) * 100).toFixed(0)}%) traen texto que no se dice y queda sin iluminar`);
  });
} else {
  console.log('  --  catálogo: assets/data/catalogo.json no está; se omite');
}

console.log(`\ncheck:marcas ${total} pruebas ok`);
