/**
 * Prueba lo puro del laboratorio de sonidos: la tabla de vocales del mapa de la boca y lo que dice de cada una.
 *
 *   npm run check:sonidos
 *
 * vocales.ts no importa nada, así que se transpila en memoria con typescript y se carga como módulo, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const fuente = fs.readFileSync(path.join(ROOT, 'src/domain/vocales.ts'), 'utf8');
const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const V = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const { sinBarras, posicionVocal, enTrapecio, cercanasEs, descripcionMapa, ORDEN_ES, VOCALES_ES, PROPORCION } = V;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

const fonemas = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/fonemas.json'), 'utf8')).fonemas;

prueba('sinBarras: quita solo las barras que encierran el símbolo', () => {
  assert.equal(sinBarras('/ɪ/'), 'ɪ');
  assert.equal(sinBarras('/aɪr/'), 'aɪr');
  assert.equal(sinBarras('ɪ'), 'ɪ');
});

prueba('todas las posiciones caen dentro del gráfico (0 a 1) y del trapecio dibujado', () => {
  for (const ipa of ['iː', 'ɪ', 'ɛ', 'æ', 'ɑː', 'ɒ', 'ɔː', 'ʊ', 'uː', 'ʌ', 'ɜː', 'ə', 'ɚ', 'ɝ']) {
    const p = posicionVocal(ipa);
    assert.ok(p, `${ipa} debería estar en la tabla`);
    assert.ok(p.atras >= 0 && p.atras <= 1 && p.abierta >= 0 && p.abierta <= 1, `${ipa} fuera de 0 a 1`);
    const { x, y } = enTrapecio(p);
    assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= PROPORCION + 1e-9, `${ipa} fuera del trapecio`);
  }
  for (const v of ORDEN_ES) assert.ok(VOCALES_ES[v], `falta la ${v} del español`);
});

prueba('el borde izquierdo del trapecio se inclina y el derecho es vertical', () => {
  assert.equal(enTrapecio({ atras: 0, abierta: 0 }).x, 0);
  assert.ok(enTrapecio({ atras: 0, abierta: 1 }).x > 0.2);
  assert.equal(enTrapecio({ atras: 1, abierta: 0 }).x, 1);
  assert.equal(enTrapecio({ atras: 1, abierta: 1 }).x, 1);
});

prueba('cercanasEs: /ɪ/ queda entre la i y la e, más cerca de la e; /æ/ más cerca de la a', () => {
  assert.deepEqual(cercanasEs(posicionVocal('ɪ')).slice(0, 2).map((c) => c.vocal), ['e', 'i']);
  assert.deepEqual(cercanasEs(posicionVocal('æ')).slice(0, 2).map((c) => c.vocal), ['a', 'e']);
});

prueba('descripcionMapa: el texto que oye el lector de pantalla', () => {
  assert.equal(descripcionMapa('/ɪ/'), 'Entre la i y la e del español, más cerca de la e');
  assert.equal(descripcionMapa('/æ/'), 'Entre la e y la a del español, más cerca de la a');
  assert.equal(descripcionMapa('/iː/'), 'Casi en el mismo lugar que la i del español');
  assert.equal(descripcionMapa('/ɛ/'), 'Entre la e y la a del español, a medio camino');
  assert.equal(descripcionMapa('/p/'), null);
});

prueba('datos: 14 de las 18 vocales simples tienen mapa; diptongos, vocal + r y consonantes no', () => {
  const conMapa = fonemas.filter((f) => posicionVocal(f.ipa)).map((f) => f.ipa);
  assert.equal(conMapa.length, 14, conMapa.join(' '));
  for (const f of fonemas) {
    if (f.tipo !== 'vocal_simple') assert.equal(posicionVocal(f.ipa), null, `${f.ipa} (${f.tipo}) no debería tener mapa`);
  }
  for (const ipa of ['/ɑr/', '/ɛr/', '/ɪr/', '/ɔr/']) assert.equal(posicionVocal(ipa), null);
});

console.log(`\ncheck:sonidos ${total} pruebas ok\n`);
