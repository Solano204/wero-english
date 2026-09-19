/**
 * Prueba los casos de "Hoy" y de destacados de Practicar.
 *
 *   npm run check:practicar
 *
 * hoy.ts no importa nada de React Native, así que se transpila en memoria
 * con typescript y se carga como módulo, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const fuente = fs.readFileSync(path.join(ROOT, 'src/screens/extras/practicar/hoy.ts'), 'utf8');
const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { elegirHoy, elegirDestacados, ORDEN, NUM_DESTACADOS } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const uso = (o) => Object.fromEntries(Object.entries(o).map(([k, [dias, ultimo]]) => [k, { dias, ultimo }]));

// Caso a: los repasos vencidos mandan sobre las atoradas y sobre el último modo.
assert.deepEqual(elegirHoy(850, 5, uso({ colmena: [3, 500] })), { modo: 'study', motivo: 'vencidas' });
assert.deepEqual(elegirHoy(1, 0, {}), { modo: 'study', motivo: 'vencidas' });
// Caso 1: frases atoradas mandan, aunque haya historial.
assert.deepEqual(elegirHoy(0, 5, uso({ colmena: [3, 500] })), { modo: 'atoran', motivo: 'atoradas' });
// Caso 2: sin atoradas, el último modo usado (por marca de tiempo, no por orden).
assert.deepEqual(elegirHoy(0, 0, uso({ colmena: [3, 900], study: [8, 200] })), { modo: 'colmena', motivo: 'ultimo' });
assert.deepEqual(elegirHoy(0, 0, uso({ pares_minimos: [1, 50], caida: [2, 40] })), { modo: 'pares_minimos', motivo: 'ultimo' });
// Caso 3: usuario nuevo, sin historial ni atoradas: Frases al azar.
assert.deepEqual(elegirHoy(0, 0, {}), { modo: 'study', motivo: 'nuevo' });

// Destacados: sin datos, los primeros del orden de siempre, sin el de HOY.
assert.deepEqual(elegirDestacados({}, 'study'), ['gramatica', 'colmena', 'pares']);
assert.deepEqual(elegirDestacados({}, 'colmena'), ['study', 'gramatica', 'pares']);
assert.deepEqual(elegirDestacados({}, 'atoran'), ['study', 'gramatica', 'colmena']);
// Con datos, los de más días de uso; los que no tienen registro rellenan por orden.
assert.deepEqual(elegirDestacados(uso({ caida: [5, 1], colmena: [2, 1] }), 'study'), ['caida', 'colmena', 'gramatica']);
// El de HOY nunca se repite, aunque sea el más usado.
assert.deepEqual(elegirDestacados(uso({ caida: [9, 1] }), 'caida'), ['study', 'gramatica', 'colmena']);

assert.equal(new Set(ORDEN).size, 17, 'ORDEN debe tener los 17 destinos sin repetir');
assert.equal(NUM_DESTACADOS, 3);
console.log('check:practicar ok (13 casos)');
