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

// Los módulos puros importan `@/utils/text`: se resuelve a mano al cargarlos.
const ALIAS = { '@/utils/text': 'src/utils/text.ts' };
const cargarUrl = async (rel) => {
  const fuenteRel = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let out = ts.transpileModule(fuenteRel, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [alias, destino] of Object.entries(ALIAS)) {
    if (out.includes(`'${alias}'`)) out = out.replaceAll(`'${alias}'`, `'${await cargarUrl(destino)}'`);
  }
  return `data:text/javascript;base64,${Buffer.from(out).toString('base64')}`;
};
const cargar = async (rel) => import(await cargarUrl(rel));
const { energiaOnda, progresoMeta, metaCumplida, ENERGIA_MIN } = await cargar('src/screens/extras/practicar/consola.ts');
const { plural, conteo } = await cargar('src/utils/text.ts');
const { metaDe, textoMeta } = await cargar('src/screens/extras/practicar/metadatos.ts');
const { diasQueQuedan, textoDiasReto } = await cargar('src/screens/extras/practicar/reto.ts');
const { resumenNivel, TOTAL_NIVELES } = await cargar('src/screens/extras/practicar/resumenNiveles.ts');

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
// Consola de HOY: la onda, el anillo de meta y el marcador.
assert.equal(energiaOnda(0), ENERGIA_MIN, '0 pendientes: onda casi plana');
assert.equal(energiaOnda(-5), ENERGIA_MIN, 'negativos no bajan del mínimo');
assert.equal(energiaOnda(95), 1, 'muchas pendientes: toda la energía');
assert.ok(energiaOnda(10) > energiaOnda(5) && energiaOnda(5) > energiaOnda(0), 'más pendientes, más energía');
assert.equal(progresoMeta(2, 20), 0.1);
assert.equal(progresoMeta(30, 20), 1, 'el anillo no pasa de lleno');
assert.equal(progresoMeta(5, 0), 0, 'sin meta, anillo vacío');
assert.equal(metaCumplida(20, 20), true);
assert.equal(metaCumplida(19, 20), false);
assert.equal(metaCumplida(3, 0), false);
// Destacados: «Nivel N · E estrellas» y la barra fina de nivel/200.
assert.equal(resumenNivel(undefined), null, 'un modo sin niveles no tiene resumen');
assert.deepEqual(resumenNivel({ jugados: 0, estrellas: 0, siguiente: 1 }), { texto: 'Nivel 1 · 200 niveles', nivel: 1 });
assert.deepEqual(resumenNivel({ jugados: 22, estrellas: 36, siguiente: 23 }), { texto: 'Nivel 23 · 36 estrellas', nivel: 23 });
assert.equal(resumenNivel({ jugados: 3, estrellas: 1, siguiente: 4 }).texto, 'Nivel 4 · 1 estrella', 'singular con una estrella');
assert.equal(resumenNivel({ jugados: 200, estrellas: 500, siguiente: 201 }).nivel, TOTAL_NIVELES, 'la barra no pasa de 200');

// Reto de la semana: los días que quedan contando hoy.
assert.equal(diasQueQuedan('2026-09-21', '2026-09-21'), 7, 'el lunes quedan 7');
assert.equal(diasQueQuedan('2026-09-21', '2026-09-24'), 4);
assert.equal(diasQueQuedan('2026-09-21', '2026-09-27'), 1, 'el domingo es el último día');
assert.equal(diasQueQuedan('2026-09-21', '2026-09-20'), 7, 'un día antes del lunes no pasa de 7');
assert.equal(diasQueQuedan('2026-09-21', '2026-10-05'), 1, 'pasada la semana no baja de 1');
assert.equal(textoDiasReto(1), 'Queda 1 día');
assert.equal(textoDiasReto(4), 'Quedan 4 días');

// Pluralización: «1 estrella», «1 frase», «1 guardada», «1 día».
assert.equal(plural(1, 'frase'), 'frase');
assert.equal(plural(0, 'frase'), 'frases', 'el cero va en plural');
assert.equal(plural(2, 'error', 'errores'), 'errores');
assert.equal(conteo(1, 'estrella'), '1 estrella');
assert.equal(conteo(36, 'estrella'), '36 estrellas');
assert.equal(conteo(1, 'guardada'), '1 guardada');
assert.equal(conteo(1, 'día'), '1 día');
assert.equal(conteo(1, 'frase avanzó', 'frases avanzaron'), '1 frase avanzó');

// Metadatos de los renglones: Badge de nivel, «nuevo», atoradas, guardadas; sin dato, nada.
const fuentes = {
  niveles: { pares: { jugados: 22, estrellas: 36, siguiente: 23 }, colmena: { jugados: 0, estrellas: 0, siguiente: 1 } },
  records: { cazala: { partidas: 3, mejor: 12 } },
  paresLimpios: 0,
  atoradas: 5,
  guardadas: 1,
  frasesPhrasal: 207,
};
assert.deepEqual(metaDe('pares', fuentes), { tipo: 'nivel', nivel: 23, estrellas: 36 });
assert.deepEqual(metaDe('colmena', fuentes), { tipo: 'nivel', nivel: 1, estrellas: 0 }, 'sin jugar arranca en el nivel 1');
assert.equal(metaDe('caida', fuentes), null, 'un juego sin niveles ni partidas no lleva Badge');
assert.deepEqual(metaDe('cazala', fuentes), { tipo: 'texto', texto: 'mejor: 12' });
assert.deepEqual(metaDe('pares_minimos', fuentes), { tipo: 'nuevo' });
assert.deepEqual(metaDe('pares_minimos', { ...fuentes, paresLimpios: 1 }), { tipo: 'texto', texto: '1 par limpio' });
assert.deepEqual(metaDe('atoran', fuentes), { tipo: 'atoradas', n: 5 });
assert.equal(metaDe('atoran', { ...fuentes, atoradas: 0 }), null, 'sin atoradas el renglón queda limpio');
assert.deepEqual(metaDe('mazo', fuentes), { tipo: 'guardadas', n: 1 });
assert.equal(metaDe('oido', fuentes), null);
assert.equal(textoMeta(metaDe('mazo', fuentes)), '1 guardada');
assert.equal(textoMeta({ tipo: 'nivel', nivel: 23, estrellas: 36 }), 'Nivel 23 · 36 estrellas');
assert.equal(textoMeta({ tipo: 'nivel', nivel: 1, estrellas: 0 }), 'Nivel 1');
assert.equal(textoMeta(null), null);

console.log('check:practicar ok (61 casos)');
