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
const M = await cargar('src/features/juegos/caida/logic/medidas.ts');
const { distanciaCaida, avance, resplandor, largoEstela, chevronsPara, CHEVRONS, ESTELA_MIN, ESTELA_MAX, ALTO_FICHA, ALTO_PISO, MARGEN_ARRIBA, MARGEN_PISO, CAIDA_MINIMA, AVISO_EN, RESPLANDOR_DESDE } = M;

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

prueba('la estela se alarga con la velocidad de la ronda y respeta sus topes', () => {
  const d = 500;
  assert.ok(largoEstela(d, 7000) < largoEstela(d, 4000), 'más rápido, más larga');
  assert.ok(largoEstela(d, 4000) < largoEstela(d, 2800));
  assert.equal(largoEstela(d, 1), ESTELA_MAX, 'un tope arriba');
  assert.equal(largoEstela(d, 1e9), ESTELA_MIN, 'y uno abajo');
  for (const raro of [0, -1, Number.NaN]) {
    assert.equal(largoEstela(raro, 3000), ESTELA_MIN);
    assert.equal(largoEstela(d, raro), ESTELA_MIN);
  }
});

prueba('los chevrons van de 1 a 5 según dónde queda la ronda entre la inicial y la mínima del nivel', () => {
  assert.equal(chevronsPara(7000, 7000, 4200), 1, 'la primera ronda: 1');
  assert.equal(chevronsPara(4200, 7000, 4200), CHEVRONS, 'en la mínima: todos');
  assert.equal(chevronsPara(3000, 7000, 4200), CHEVRONS, 'más rápido que la mínima no se sale');
  assert.equal(chevronsPara(9000, 7000, 4200), 1, 'ni más lento que la inicial');
  assert.equal(chevronsPara(5600, 7000, 4200), 3, 'a la mitad: 3');
  assert.equal(chevronsPara(5000, 5000, 5000), 1, 'un nivel sin rango no tiene ritmo que mostrar');
  assert.equal(chevronsPara(Number.NaN, 7000, 4200), 1);
});

prueba('en los niveles reales el ritmo sube de la ronda 1 a la última sin pasarse de 5', () => {
  const niveles = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/niveles.json'), 'utf8')).juegos.caida.niveles;
  const duracion = (n, r) => Math.max(n.caidaMinimaMs, n.caidaInicialMs - r * n.aceleraMs);
  let algunoLlegaA5 = false;
  for (const n of niveles) {
    let antes = 0;
    for (let r = 0; r < n.rondas; r++) {
      const c = chevronsPara(duracion(n, r), n.caidaInicialMs, n.caidaMinimaMs);
      assert.ok(c >= 1 && c <= CHEVRONS, `nivel ${n.n} ronda ${r + 1}`);
      assert.ok(c >= antes, `nivel ${n.n}: el ritmo no baja de una ronda a la siguiente`);
      antes = c;
      if (c === CHEVRONS) algunoLlegaA5 = true;
    }
    assert.equal(chevronsPara(duracion(n, 0), n.caidaInicialMs, n.caidaMinimaMs), 1, `nivel ${n.n} empieza en 1`);
  }
  console.log(`      (algún nivel llega a 5 chevrons: ${algunoLlegaA5})`);
});

console.log(`\ncheck:caida ${total} pruebas ok`);
