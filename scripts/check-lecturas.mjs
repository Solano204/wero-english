/**
 * Prueba lo puro de Lecturas sobre las 24 historias reales (29 capítulos):
 *
 *   npm run check:lecturas
 *
 *  - la división en oraciones (diálogos, abreviaturas, párrafos) y que cada oración se pueda recuperar del texto
 *    por su posición;
 *  - los tiempos de cada oración: la estimación por caracteres y las marcas de oración de Polly;
 *  - el reparto de las frases del catálogo (subrayadas) entre las oraciones;
 *  - el generador: que ninguna frase del catálogo vaya con mayúscula a media oración.
 *
 * oraciones.ts y lectura.ts no importan nada (solo tipos): se transpilan en memoria con typescript, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const cargar = async (rel) => {
  const js = ts.transpileModule(leer(rel), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};

const O = await cargar('src/domain/oraciones.ts');
const { partirTexto } = await cargar('src/domain/lectura.ts');
const lecturas = JSON.parse(leer('assets/data/lecturas.json')).lecturas;
const catalogo = new Map(JSON.parse(leer('assets/data/catalogo.json')).entries.map((e) => [e.id, e]));
const capitulos = lecturas.flatMap((l) => l.capitulos.map((c) => ({ l, c })));

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};
const textos = (t) => O.dividirOraciones(t).map((o) => o.texto);

/* ---------- oraciones ---------- */

prueba('oraciones: un punto, una interrogación y una exclamación cierran; las acotaciones de diálogo no', () => {
  assert.deepEqual(textos('Wero is a dog. He waits! Why?'), ['Wero is a dog.', 'He waits!', 'Why?']);
  assert.deepEqual(textos('"How\'s it going?" says Don Beto, the man who makes tacos. Wero moves.'), [
    '"How\'s it going?" says Don Beto, the man who makes tacos.',
    'Wero moves.',
  ]);
  assert.deepEqual(textos('"That\'s it?" the boy says. "My taco?"'), ['"That\'s it?" the boy says.', '"My taco?"']);
  assert.deepEqual(textos('"Stop," she says. "Now."'), ['"Stop," she says.', '"Now."']);
});

prueba('oraciones: abreviaturas, puntos suspensivos, decimales y comillas de cierre', () => {
  assert.deepEqual(textos('Mr. Smith is here. He waits.'), ['Mr. Smith is here.', 'He waits.']);
  assert.deepEqual(textos('Well... maybe not. Go.'), ['Well... maybe not.', 'Go.']);
  assert.deepEqual(textos('It costs 3.5 dollars. Ok.'), ['It costs 3.5 dollars.', 'Ok.']);
  assert.deepEqual(textos('She said "no." Then she left.'), ['She said "no."', 'Then she left.']);
  assert.deepEqual(textos(''), []);
  assert.deepEqual(textos('   \n\n  '), []);
});

prueba('oraciones: los párrafos se separan con una línea en blanco y cada oración lleva su posición exacta', () => {
  const t = 'One two.  Three.\n\nFour five.\n\n\nSix.';
  const o = O.dividirOraciones(t);
  assert.deepEqual(o.map((x) => x.parrafo), [0, 0, 1, 2]);
  for (const x of o) assert.equal(t.slice(x.inicio, x.fin), x.texto);
});

prueba('oraciones: en los 29 capítulos reales cada una se recupera por su posición y no se pierde nada', () => {
  let n = 0;
  let cortas = 0;
  let largas = 0;
  for (const { l, c } of capitulos) {
    const o = O.dividirOraciones(c.texto);
    assert.ok(o.length >= 3, `${l.id} cap ${c.n}: solo ${o.length} oraciones`);
    let cursor = 0;
    for (const x of o) {
      assert.equal(c.texto.slice(x.inicio, x.fin), x.texto, `${l.id} cap ${c.n}: posición`);
      assert.ok(x.inicio >= cursor, `${l.id} cap ${c.n}: se solapan`);
      assert.ok(/^\s*$/.test(c.texto.slice(cursor, x.inicio)), `${l.id} cap ${c.n}: se perdió texto «${c.texto.slice(cursor, x.inicio)}»`);
      assert.ok(!/^[a-z]/.test(x.texto), `${l.id} cap ${c.n}: empieza en minúscula «${x.texto.slice(0, 40)}»`);
      assert.ok(x.texto.length >= 2, `${l.id} cap ${c.n}: oración vacía`);
      cursor = x.fin;
      n++;
      if (x.texto.length < 12) cortas++;
      if (x.texto.length > 220) largas++;
    }
    assert.ok(/^\s*$/.test(c.texto.slice(cursor)), `${l.id} cap ${c.n}: se perdió el final`);
  }
  console.log(`      ${n} oraciones en ${capitulos.length} capítulos (${cortas} de menos de 12 caracteres, ${largas} de más de 220)`);
});

/* ---------- tiempos ---------- */

prueba('tiempos estimados: empiezan en 0, crecen, no pasan de la duración y son proporcionales a los caracteres', () => {
  for (const { l, c } of capitulos) {
    const o = O.dividirOraciones(c.texto);
    const t = O.inicioEstimado(o, 90);
    assert.equal(t[0], 0);
    for (let i = 1; i < t.length; i++) assert.ok(t[i] >= t[i - 1], `${l.id}: retrocede`);
    assert.ok(t[t.length - 1] < 90);
  }
  const o = O.dividirOraciones('Aa. Bbbbbbbb.');
  const t = O.inicioEstimado(o, 10);
  assert.ok(Math.abs(t[1] - (10 * 3) / 12) < 1e-9);
  assert.deepEqual(O.inicioEstimado(o, 0), [0, 0]);
  assert.deepEqual(O.inicioEstimado(o, Number.NaN), [0, 0]);
  assert.deepEqual(O.inicioEstimado([], 10), []);
});

prueba('marcas de Polly: se usan si son de este texto, se colocan por su posición y nunca retroceden', () => {
  const texto = 'One two. Three four. Five six.';
  const o = O.dividirOraciones(texto);
  const marcas = { n: texto.length, s: [[0, 0, 8], [1500, 9, 20], [3200, 21, 30]] };
  assert.deepEqual(O.inicioDeMarcas(o, marcas, texto.length, 5), [0, 1.5, 3.2]);
  // Polly junta dos oraciones en una marca: la segunda queda entre esa marca y la siguiente.
  const junta = { n: texto.length, s: [[0, 0, 20], [3000, 21, 30]] };
  const tj = O.inicioDeMarcas(o, junta, texto.length, 5);
  assert.equal(tj[0], 0);
  assert.ok(tj[1] > 0 && tj[1] < 3 && tj[2] === 3);
  // Se ignoran si son de otro texto, están vacías, mal formadas o fuera de orden.
  assert.equal(O.inicioDeMarcas(o, { ...marcas, n: texto.length + 1 }, texto.length, 5), null);
  assert.equal(O.inicioDeMarcas(o, { n: texto.length, s: [] }, texto.length, 5), null);
  assert.equal(O.inicioDeMarcas(o, undefined, texto.length, 5), null);
  assert.equal(O.inicioDeMarcas(o, { n: texto.length, s: [[2000, 0, 8], [1000, 9, 20]] }, texto.length, 5), null);
  assert.equal(O.inicioDeMarcas(o, { n: texto.length, s: [[0, 8, 8]] }, texto.length, 5), null);
  // Con una duración más corta que las marcas, no pasa de la duración.
  assert.ok(O.inicioDeMarcas(o, marcas, texto.length, 2).every((x) => x <= 2));
});

prueba('la oración que suena: la última que ya empezó; antes de la primera, la primera', () => {
  const inicios = [0, 2, 5, 9];
  assert.equal(O.indiceEn(inicios, -1), 0);
  assert.equal(O.indiceEn(inicios, 0), 0);
  assert.equal(O.indiceEn(inicios, 1.99), 0);
  assert.equal(O.indiceEn(inicios, 2), 1);
  assert.equal(O.indiceEn(inicios, 8.9), 2);
  assert.equal(O.indiceEn(inicios, 100), 3);
  assert.equal(O.indiceEn([0], 3), 0);
  assert.equal(O.indiceEn([], 3), 0);
});

/* ---------- frases del catálogo dentro de las oraciones ---------- */

prueba('frases del catálogo: los trozos se reparten entre las oraciones sin perder ni repetir texto', () => {
  let frases = 0;
  let cruzan = 0;
  for (const { l, c } of capitulos) {
    const conocidas = l.frases
      .map((id) => catalogo.get(id))
      .filter(Boolean)
      .map((e) => ({ id: e.id, phrase: e.phrase, nueva: false }));
    const trozos = partirTexto(c.texto, conocidas);
    assert.equal(trozos.map((t) => t.texto).join(''), c.texto, `${l.id}: partirTexto no reconstruye el capítulo`);
    const o = O.dividirOraciones(c.texto);
    O.trozosPorOracion(o, trozos).forEach((delaOracion, i) => {
      assert.equal(delaOracion.map((t) => t.texto).join(''), o[i].texto, `${l.id} cap ${c.n}: oración ${i}`);
    });
    let desde = 0;
    for (const t of trozos) {
      const hasta = desde + t.texto.length;
      if (t.entryId !== null) {
        frases++;
        if (!o.some((x) => x.inicio <= desde && hasta <= x.fin)) cruzan++;
      }
      desde = hasta;
    }
  }
  console.log(`      ${frases} frases del catálogo repartidas; ${cruzan} cruzan el límite de una oración`);
  assert.equal(cruzan, 0, 'una frase del catálogo no debería cruzar dos oraciones');
});

/* ---------- generador y datos ---------- */

prueba('generador: ninguna frase del catálogo va con mayúscula a media oración (salvo «I»)', () => {
  for (const l of lecturas) {
    const texto = l.capitulos.map((c) => c.texto).join('\n\n');
    for (const id of l.frases) {
      const f = catalogo.get(id).phrase;
      const re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      for (const m of texto.matchAll(re)) {
        const antes = texto.slice(0, m.index).replace(/ +$/, '');
        const abre = antes === '' || /[.?!…]["'”’)]*$/.test(antes) || /[\n"“]$/.test(antes);
        assert.ok(!(/^[A-Z]/.test(m[0]) && !/^I\b/.test(m[0]) && !abre), `${l.id}: «${m[0]}» va con mayúscula a media oración`);
      }
    }
  }
  assert.ok(leer('assets/data/lecturas.json').includes('a large soda'));
});

prueba('los 29 capítulos conservan su audio tras regenerar', () => {
  assert.equal(capitulos.length, 29);
  for (const { l, c } of capitulos) assert.match(c.audio ?? '', /^aud\/lec\/.+\.mp3$/, `${l.id} cap ${c.n}`);
});

prueba('marcas de oración y salto de audio: el índice es un objeto válido, hay quien lo lee y quien lo genera, y el audio puede saltar', () => {
  const indice = JSON.parse(leer('assets/data/marcas_oraciones.json'));
  assert.equal(typeof indice, 'object');
  for (const [ruta, m] of Object.entries(indice)) {
    assert.match(ruta, /^aud\/lec\//);
    assert.ok(Number.isInteger(m.n) && Array.isArray(m.s) && m.s.length > 0, `${ruta}: marcas mal formadas`);
    const texto = capitulos.find(({ c }) => c.audio === ruta)?.c.texto;
    assert.ok(texto !== undefined, `${ruta}: no es el audio de ningún capítulo`);
    assert.equal(m.n, texto.length, `${ruta}: las marcas son de otro texto`);
  }
  assert.match(leer('src/services/marcas.ts'), /export function marcasOracionesDe/);
  assert.match(leer('src/services/audio.ts'), /export async function saltarFrase\(seg: number\)/);
  const polly = leer('scripts/polly.mjs');
  assert.match(polly, /--marcas-oraciones/);
  assert.match(polly, /SpeechMarkTypes: \["sentence"\]/);
});

console.log(`\ncheck:lecturas ${total} pruebas ok\n`);
