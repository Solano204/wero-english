/**
 * Prueba la lógica pura de Estudio: el diff letra por letra de Dictado y Escribir.
 *
 *   npm run check:estudio
 *
 * diff.ts no importa nada de React Native, así que se transpila en memoria con
 * typescript y se carga como módulo, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const cargar = async (rel) => {
  const fuente = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const { diffLetras } = await cargar('src/domain/diff.ts');

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};
const tramos = (dado, esperado) => diffLetras(dado, esperado).map((t) => `${t.tipo}:${t.texto}`);

prueba('diff: igual, sin mirar mayúsculas ni acentos', () => {
  assert.deepEqual(tramos('hello world', 'Hello world'), ['igual:Hello world']);
  assert.deepEqual(tramos('cafe', 'café'), ['igual:café']);
  assert.deepEqual(tramos('don’t', "don't"), ["igual:don't"]);
});

prueba('diff: una letra que falta queda marcada en su lugar', () => {
  assert.deepEqual(tramos('helo', 'hello'), ['igual:hel', 'falta:l', 'igual:o']);
  assert.deepEqual(tramos('go hom', 'go home'), ['igual:go hom', 'falta:e']);
});

prueba('diff: una letra que sobra queda marcada', () => {
  assert.deepEqual(tramos('hellooo', 'hello'), ['igual:hello', 'extra:oo']);
  assert.deepEqual(tramos('thee dog', 'the dog'), ['igual:the', 'extra:e', 'igual: dog']);
});

prueba('diff: una letra cambiada es una que sobra y una que falta', () => {
  assert.deepEqual(tramos('cat', 'cot'), ['igual:c', 'extra:a', 'falta:o', 'igual:t']);
});

prueba('diff: vacío y sin nada en común', () => {
  assert.deepEqual(tramos('', 'hi'), ['falta:hi']);
  assert.deepEqual(tramos('hi', ''), ['extra:hi']);
  assert.deepEqual(tramos('', ''), []);
  assert.deepEqual(tramos('abc', 'xyz'), ['extra:abc', 'falta:xyz']);
});

prueba('diff: lo igual y lo que falta reconstruyen siempre la frase esperada', () => {
  const casos = [
    ['I wanna go home', 'I want to go home'],
    ['their going to the store', "They're going to the store"],
    ['', 'Anything'],
    ['ZZZ', 'a'],
    ['same', 'same'],
  ];
  for (const [dado, esperado] of casos) {
    const t = diffLetras(dado, esperado);
    const esp = t.filter((x) => x.tipo !== 'extra').map((x) => x.texto).join('');
    assert.equal(esp, esperado, `${dado} -> ${esperado}`);
    // Los tramos contiguos siempre son de distinto tipo.
    for (let i = 1; i < t.length; i++) assert.notEqual(t[i].tipo, t[i - 1].tipo);
  }
});

prueba('diff: una frase larga se compara sin problema', () => {
  const esperado = 'And if that is a shared dev staging DB others rely on, you just wiped their test data too'.repeat(3);
  const dado = esperado.replace('shared', 'sharred').replace('wiped', 'wipe');
  const t = diffLetras(dado, esperado);
  assert.ok(t.some((x) => x.tipo === 'extra'));
  assert.ok(t.some((x) => x.tipo === 'falta'));
});

const { nivelSeguidas, ESCALONES_SEGUIDAS } = await cargar('src/domain/seguidas.ts');

prueba('seguidas: el brillo da un escalón a los 3, 5 y 10 aciertos y no antes', () => {
  assert.deepEqual([...ESCALONES_SEGUIDAS], [3, 5, 10]);
  const niveles = [0, 1, 2, 3, 4, 5, 9, 10, 25].map(nivelSeguidas);
  assert.deepEqual(niveles, [0, 0, 0, 1, 1, 2, 2, 3, 3]);
});

prueba('seguidas: un fallo (0) apaga el brillo y los valores raros no rompen', () => {
  assert.equal(nivelSeguidas(0), 0);
  assert.equal(nivelSeguidas(-4), 0);
  assert.equal(nivelSeguidas(Number.NaN), 0);
  assert.equal(nivelSeguidas(Number.POSITIVE_INFINITY), 0);
});

console.log(`\ncheck:estudio ${total} pruebas ok`);
