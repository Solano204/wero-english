/**
 * Prueba la lógica pura de las preguntas del perfil (src/domain/perfilInicial.ts): avanzar, regresar, saltar desde
 * la barra de avance, volver al resumen tras «Cambiar», el borrador que se guarda y lo que se aplica al terminar.
 *
 *   npm run check:perfil
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const ts = require('typescript');

const fuente = fs.readFileSync(path.join(ROOT, 'src/domain/perfilInicial.ts'), 'utf8');
const { outputText } = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const modulo = { exports: {} };
new Function('module', 'exports', outputText)(modulo, modulo.exports);
const P = modulo.exports;

const vacias = { limpio: null, porDia: 4, desde: '09:00', hasta: '21:00' };

// «Siguiente» se activa con respuesta; «Cuántas al día» ya viene elegida.
assert.equal(P.puedeAvanzar(vacias, 'p1'), false);
assert.equal(P.puedeAvanzar({ ...vacias, limpio: false }, 'p1'), true);
assert.equal(P.puedeAvanzar(vacias, 'p2'), true);

// Avanzar y regresar.
assert.equal(P.destinoSiguiente('p1', false), 'p2');
assert.equal(P.destinoSiguiente('p2', false), 'resumen');
assert.equal(P.destinoSiguiente('p2', true), 'resumen');
assert.equal(P.destinoSiguiente('p1', true), 'resumen'); // venía de «Cambiar»: regresa al resumen
assert.equal(P.pasoAnterior('resumen'), 'p2');
assert.equal(P.pasoAnterior('p2'), 'p1');
assert.equal(P.pasoAnterior('p1'), 'p1');

// Contestar 3 pasos, regresar al 1 y cambiarlo: lo demás se conserva.
const r = { ...vacias, limpio: false, porDia: 6, desde: '15:00', hasta: '21:00' };
const despues = { ...r, limpio: true };
assert.deepEqual({ ...despues, limpio: r.limpio }, r);
assert.equal(despues.porDia, 6);
assert.equal(despues.desde, '15:00');

// La barra de avance: solo se salta a lo ya alcanzado.
assert.equal(P.puedeSaltarA(1, 'p1'), true);
assert.equal(P.puedeSaltarA(1, 'p2'), true);
assert.equal(P.puedeSaltarA(1, 'resumen'), false);
assert.equal(P.puedeSaltarA(2, 'resumen'), true);

assert.equal(P.textoProgreso('p2'), 'Pregunta 2 de 2');
assert.equal(P.textoProgreso('resumen'), 'Revisa tus respuestas');

// El borrador sobrevive a guardarse como JSON y un borrador dañado se descarta.
const borrador = { paso: 'p2', alcanzado: 1, respuestas: despues };
assert.deepEqual(P.leerBorrador(JSON.parse(JSON.stringify(borrador))), borrador);
assert.equal(P.leerBorrador(null), null);
assert.equal(P.leerBorrador({ paso: 'xx', alcanzado: 1, respuestas: despues }), null);
assert.equal(P.leerBorrador({ paso: 'p1', alcanzado: 0, respuestas: { limpio: 'si' } }), null);
assert.equal(P.leerBorrador({ paso: 'p1', alcanzado: 99, respuestas: despues }).alcanzado, 2);

// Lo que se aplica: todo al tocar «Listo»; solo lo contestado al «Saltar».
assert.deepEqual(P.valoresFinales(despues), { modoLimpio: true, notifPorDia: 6, notifDesde: '15:00', notifHasta: '21:00' });
assert.deepEqual(P.valoresFinales(vacias), { modoLimpio: false, notifPorDia: 4, notifDesde: '09:00', notifHasta: '21:00' });
assert.deepEqual(P.valoresContestados(vacias, 0), {});
assert.deepEqual(P.valoresContestados({ ...vacias, limpio: true }, 0), { modoLimpio: true });
assert.deepEqual(P.valoresContestados({ ...vacias, limpio: true }, 1), { modoLimpio: true, notifPorDia: 4, notifDesde: '09:00', notifHasta: '21:00' });

// El resumen.
const filas = P.resumenRespuestas({ ...vacias, limpio: true, porDia: 0 });
assert.equal(filas.length, 2);
assert.equal(filas[0].respuesta, 'No, déjalo limpio');
assert.equal(filas[1].respuesta, 'Ninguna');
assert.equal(P.textoAvisos(4, '08:00', '13:00'), '4 al día · Solo en la mañana');

console.log('check:perfil · ok');
