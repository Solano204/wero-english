/**
 * Prueba cómo se juzga lo que oyó el reconocedor en «Di la palabra» (src/domain/minimalPairs.ts) y cómo se leen sus
 * alternativas (src/domain/voz.ts), con transcripciones como las que manda el reconocedor de Android. También revisa
 * la tabla assets/data/confusiones_voz.json contra los pares de fonemas.json.
 *
 *   npm run check:voz
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const ts = require('typescript');

const cache = new Map();
function resolver(spec, desde) {
  const base = spec.startsWith('@/') ? path.join(ROOT, 'src', spec.slice(2)) : path.resolve(path.dirname(desde), spec);
  for (const c of [`${base}.ts`, path.join(base, 'index.ts')]) if (fs.existsSync(c)) return c;
  throw new Error(`no se pudo resolver ${spec} desde ${path.relative(ROOT, desde)}`);
}
function cargar(archivo) {
  if (cache.has(archivo)) return cache.get(archivo);
  let js = ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  js = js.replace(/(from\s+|import\()\s*(["'])([^"']+)\2/g, (_, pre, q, spec) => {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) {
      throw new Error(`${path.relative(ROOT, archivo)} importa el paquete ${spec}: no es un módulo puro`);
    }
    return `${pre}"${cargar(resolver(spec, archivo))}"`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  cache.set(archivo, url);
  return url;
}
const importar = (rel) => import(cargar(path.join(ROOT, rel)));

const { juzgar, explicar, clavePar } = await importar('src/domain/minimalPairs.ts');
const { extraerAlternativas, ordenarPorConfianza } = await importar('src/domain/voz.ts');
const confusiones = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/confusiones_voz.json'), 'utf8'));
const fonemas = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/fonemas.json'), 'utf8'));
const V = confusiones.pares;

let n = 0;
function prueba(nombre, fn) {
  fn();
  n++;
  console.log(`  ok  ${nombre}`);
}
const par = (objetivo, confusa) => ({ id: `t:${objetivo}`, objetivo, confusa, objetivoIpa: '', objetivoEs: '', confusaEs: '', audioObjetivo: '', fonema: '', elErrorTipico: '' });
const alts = (...textos) => textos.map((texto) => ({ texto, confianza: null }));
const tipo = (r, oido, criterio) => juzgar(r, oido, V, criterio).tipo;

prueba('la palabra exacta, en la 1.ª alternativa y dentro de una frase', () => {
  assert.equal(tipo(par('sheep', 'ship'), alts('sheep')), 'acierto');
  assert.equal(tipo(par('sheep', 'ship'), alts('Sheep.')), 'acierto');
  assert.equal(tipo(par('sheep', 'ship'), alts('the sheep please')), 'acierto');
});

prueba('acierto en la 2.ª o 3.ª alternativa cuando las de arriba son ruido', () => {
  const r = juzgar(par('sheep', 'ship'), alts('she', 'sheep', 'ship'), V);
  assert.equal(r.tipo, 'acierto');
  assert.equal(r.oido, 'sheep');
  assert.equal(tipo(par('leave', 'live'), alts('eve', 'lea', 'leave')), 'acierto');
});

prueba('la confusa gana si sale antes que la buena (se le pasan las dos al reconocedor como pistas)', () => {
  assert.equal(tipo(par('sheep', 'ship'), alts('ship', 'sheep')), 'confusa');
  assert.equal(tipo(par('sheep', 'ship'), alts('ship', 'sheep'), 'cualquiera'), 'acierto');
  assert.equal(tipo(par('full', 'fool'), alts('fool')), 'confusa');
  assert.equal(tipo(par('cat', 'cut'), alts('cut it', 'cat')), 'confusa');
});

prueba('si una alternativa trae las dos, cuenta la buena (como siempre)', () => {
  assert.equal(tipo(par('sheep', 'ship'), alts('ship sheep')), 'acierto');
});

prueba('plural y posesivo, salvo que la otra palabra sea justo esa forma', () => {
  assert.equal(tipo(par('ship', 'chip'), alts('ships')), 'acierto');
  assert.equal(tipo(par('ship', 'chip'), alts('chips')), 'confusa');
  assert.equal(tipo(par('cat', 'cut'), alts("cat's")), 'acierto');
  assert.equal(tipo(par('car', 'cars'), alts('cars')), 'confusa', 'si la confusa ES el plural, el plural es la confusa');
  assert.equal(tipo(par('berry', 'very'), alts('berries')), 'acierto');
});

prueba('una letra de diferencia: solo en palabras de 4+ letras y nunca si queda igual de cerca de la confusa', () => {
  assert.equal(tipo(par('sheep', 'ship'), alts('sheet')), 'acierto');
  assert.equal(tipo(par('leave', 'live'), alts('leaves')), 'acierto');
  assert.equal(tipo(par('feel', 'fill'), alts('fell')), 'no_entendi', 'fell queda a una letra de las dos');
  assert.equal(tipo(par('cat', 'cut'), alts('cap')), 'no_entendi', 'en 3 letras no se perdona');
  assert.equal(tipo(par('full', 'fool'), alts('foal')), 'confusa', 'foal está a una de fool y a dos de full');
});

prueba('homófonos de la tabla: cuentan como la palabra a la que suenan igual', () => {
  assert.equal(tipo(par('right', 'light'), alts('write')), 'acierto');
  assert.equal(tipo(par('light', 'right'), alts('write')), 'confusa');
  assert.equal(tipo(par('now', 'no'), alts('know')), 'confusa');
  assert.equal(tipo(par('high', 'eye'), alts('hi')), 'acierto');
  assert.equal(tipo(par('high', 'eye'), alts('I')), 'confusa');
  assert.equal(tipo(par('sheep', 'cheap'), alts('cheap')), 'confusa', 'cheap por sheep es el error que se enseña');
});

prueba('silencio, vacío y ruido: no_entendi (no es error de quien habla)', () => {
  assert.equal(tipo(par('sheep', 'ship'), null), 'no_entendi');
  assert.equal(tipo(par('sheep', 'ship'), []), 'no_entendi');
  assert.equal(tipo(par('sheep', 'ship'), alts('   ')), 'no_entendi');
  const ruido = juzgar(par('sheep', 'ship'), alts('hello there', 'yellow'), V);
  assert.equal(ruido.tipo, 'no_entendi');
  assert.equal(ruido.oido, 'hello there');
  assert.equal(ruido.alternativas.length, 2);
  const e = explicar(par('sheep', 'ship'), ruido);
  assert.equal(e.titulo, 'No alcancé a oírte bien');
});

prueba('una transcripción suelta (texto) sigue funcionando', () => {
  assert.equal(tipo(par('beach', 'bitch'), 'Beach'), 'acierto');
  assert.equal(tipo(par('beach', 'bitch'), ''), 'no_entendi');
});

prueba('alternativas del evento result: todas, sin repetidas, con su confianza (−1 y 0 son «no se sabe»)', () => {
  const a = extraerAlternativas({
    isFinal: true,
    results: [
      { transcript: 'Sheep', confidence: 0.91 },
      { transcript: 'ship', confidence: 0 },
      { transcript: 'sheep', confidence: -1 },
      { transcript: '', confidence: 0.2 },
    ],
  });
  assert.deepEqual(a, [
    { texto: 'Sheep', confianza: 0.91 },
    { texto: 'ship', confianza: null },
  ]);
  assert.deepEqual(extraerAlternativas({ value: ['a', 'b'] }).map((x) => x.texto), ['a', 'b']);
  assert.deepEqual(extraerAlternativas({ transcript: 'cat' }).map((x) => x.texto), ['cat']);
  assert.deepEqual(extraerAlternativas(null), []);
});

prueba('orden de confianza: solo se reordena si todas la traen', () => {
  const con = [
    { texto: 'a', confianza: 0.2 },
    { texto: 'b', confianza: 0.9 },
  ];
  assert.deepEqual(ordenarPorConfianza(con).map((x) => x.texto), ['b', 'a']);
  const sin = [
    { texto: 'a', confianza: 0.2 },
    { texto: 'b', confianza: null },
  ];
  assert.deepEqual(ordenarPorConfianza(sin).map((x) => x.texto), ['a', 'b']);
});

prueba('confusiones_voz.json: cada par existe, las variantes no son ni suenan a la otra palabra', () => {
  const pares = new Set();
  for (const f of fonemas.fonemas) for (const p of f.pares_minimos) pares.add(clavePar(p.a, p.b));
  assert.ok(confusiones.fuente.length > 0 && confusiones.version >= 1);
  for (const [clave, porPalabra] of Object.entries(V)) {
    assert.ok(pares.has(clave), `${clave} no es un par de fonemas.json`);
    const [x, y] = clave.split('|');
    for (const [palabra, variantes] of Object.entries(porPalabra)) {
      assert.ok(palabra === x || palabra === y, `${clave}: ${palabra} no es del par`);
      const otra = palabra === x ? y : x;
      for (const v of variantes) {
        assert.equal(v, v.toLowerCase(), `${clave}: ${v} va en minúsculas`);
        assert.notEqual(v, otra, `${clave}: ${v} es la otra palabra`);
        assert.ok(!(porPalabra[otra] ?? []).includes(v), `${clave}: ${v} está en los dos lados`);
      }
    }
  }
});

console.log(`\ncheck:voz ${n} pruebas ok`);
