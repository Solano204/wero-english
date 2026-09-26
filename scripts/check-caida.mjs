/**
 * Prueba las medidas de la pista de Caída.
 *
 *   npm run check:caida
 *
 * medidas.ts no importa nada, así que se transpila en memoria con typescript y se carga
 * como módulo, sin jest.
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
const M = await cargar('src/components/juegos/caida/medidas.ts');
const { distanciaCaida, avance, resplandor, ALTO_FICHA, ALTO_PISO, MARGEN_ARRIBA, MARGEN_PISO, CAIDA_MINIMA, AVISO_EN, RESPLANDOR_DESDE } = M;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

prueba('la ficha se detiene exactamente sobre el piso, en cualquier alto de pista', () => {
  for (const pista of [420, 480, 520, 560, 640, 720, 800, 900]) {
    const d = distanciaCaida(pista);
    const abajoDeLaFila = MARGEN_ARRIBA + d + ALTO_FICHA;
    const arribaDelPiso = pista - MARGEN_PISO - ALTO_PISO;
    assert.equal(abajoDeLaFila, arribaDelPiso, `pista de ${pista}: la fila termina donde empieza el piso`);
  }
});

prueba('una pista muy baja o entradas raras dan el recorrido mínimo, no uno negativo', () => {
  for (const pista of [0, 100, 150, -20, Number.NaN]) {
    assert.equal(distanciaCaida(pista), CAIDA_MINIMA);
  }
});

prueba('el avance va de 0 a 1 y no se sale', () => {
  assert.equal(avance(0, 400), 0);
  assert.equal(avance(200, 400), 0.5);
  assert.equal(avance(400, 400), 1);
  assert.equal(avance(999, 400), 1);
  assert.equal(avance(-5, 400), 0);
  assert.equal(avance(50, 0), 0, 'sin recorrido no hay avance');
  assert.equal(avance(50, Number.NaN), 0);
});

prueba('el piso se enciende de 0 a 1 en el último 30 % y nunca antes', () => {
  assert.equal(RESPLANDOR_DESDE, 0.7);
  assert.equal(resplandor(0), 0);
  assert.equal(resplandor(0.5), 0);
  assert.equal(resplandor(0.7), 0);
  assert.ok(Math.abs(resplandor(0.85) - 0.5) < 1e-9);
  assert.equal(resplandor(1), 1);
  assert.equal(resplandor(1.4), 1);
  let anterior = 0;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const r = resplandor(p);
    assert.ok(r >= anterior - 1e-12, 'no baja al avanzar');
    anterior = r;
  }
});

prueba('el aviso llega con el piso ya encendiéndose pero lejos de encendido del todo', () => {
  assert.equal(AVISO_EN, 0.75);
  assert.ok(AVISO_EN > RESPLANDOR_DESDE && AVISO_EN < 1);
  assert.ok(resplandor(AVISO_EN) > 0 && resplandor(AVISO_EN) < 0.25);
});

prueba('las pantallas reales de un teléfono (640 a 900 dp de alto) dejan una caída larga', () => {
  // Encabezado y frase ocupan unos 230 dp arriba de la pista.
  for (const alto of [640, 700, 780, 850, 900]) {
    const pista = alto - 230;
    assert.ok(distanciaCaida(pista) >= 200, `pista de ${pista} dp: ${distanciaCaida(pista)} dp de caída`);
  }
});

prueba('los niveles de Caída traen su propio ritmo y ninguno cae más lento que su mínimo', () => {
  const niveles = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/niveles.json'), 'utf8')).juegos.caida.niveles;
  assert.equal(niveles.length, 200);
  for (const n of niveles) {
    assert.ok(n.caidaInicialMs >= n.caidaMinimaMs, `nivel ${n.n}`);
    assert.ok(Number.isInteger(n.rondas) && n.rondas >= 1);
  }
});

console.log(`\ncheck:caida ${total} pruebas ok`);
