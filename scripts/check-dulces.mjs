/**
 * Prueba lo puro de Dulces: las formas de las piezas y el contraste de su símbolo.
 *
 *   npm run check:dulces
 *
 * piezas.ts no importa nada, así que se transpila en memoria con typescript y se carga como módulo, sin jest.
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
const P = await cargar('src/components/juegos/dulces/piezas.ts');
const { FORMAS, COLORES_MAX, NOMBRE_FORMA, NOMBRE_COLOR, TRAZOS, formaDe, nombreColor, etiquetaPieza, indiceMasCercana } = P;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

const niveles = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/niveles.json'), 'utf8')).juegos.dulces.niveles;
const tokens = fs.readFileSync(path.join(ROOT, 'src/theme/tokens.ts'), 'utf8');

prueba('cada color lleva su propia forma y su propio nombre', () => {
  assert.equal(COLORES_MAX, 6);
  assert.equal(new Set(FORMAS).size, COLORES_MAX, 'seis formas distintas');
  assert.equal(new Set(NOMBRE_COLOR).size, COLORES_MAX, 'seis nombres de color distintos');
  assert.equal(new Set(FORMAS.map((f) => NOMBRE_FORMA[f])).size, COLORES_MAX, 'seis nombres de forma distintos');
  for (let c = 0; c < COLORES_MAX; c++) assert.equal(formaDe(c), FORMAS[c]);
});

prueba('el ejemplo del prompt: «Pieza naranja, círculo, fila 2 columna 3»', () => {
  assert.equal(etiquetaPieza(0, 1, 2), 'Pieza naranja, círculo, fila 2 columna 3');
  assert.equal(etiquetaPieza(4, 0, 0), 'Pieza lima, estrella, fila 1 columna 1');
  assert.equal(etiquetaPieza(5, 8, 7), 'Pieza turquesa, hexágono, fila 9 columna 8');
});

prueba('un color fuera de rango da la vuelta: nunca hay una pieza sin forma ni nombre', () => {
  assert.equal(formaDe(6), formaDe(0));
  assert.equal(formaDe(-1), formaDe(5));
  assert.equal(nombreColor(7), nombreColor(1));
  assert.ok(etiquetaPieza(99, 0, 0).startsWith('Pieza '));
});

prueba('los niveles reales piden a lo más los colores que hay (antes el sexto salía gris y sin forma)', () => {
  const colores = new Set(niveles.map((n) => n.colores));
  assert.deepEqual([...colores].sort(), [4, 5, 6]);
  for (const n of niveles) assert.ok(n.colores <= COLORES_MAX, `nivel ${n.n}`);
  assert.ok(niveles.some((n) => n.colores === 6), 'hay niveles de seis colores');
  for (const n of niveles) {
    const formas = new Set(Array.from({ length: n.colores }, (_, c) => formaDe(c)));
    assert.equal(formas.size, n.colores, `nivel ${n.n}: una forma distinta por color`);
  }
});

prueba('los trazos son bien formados y distintos', () => {
  const formas = Object.keys(TRAZOS);
  assert.equal(formas.length, COLORES_MAX);
  for (const f of formas) {
    const d = TRAZOS[f];
    assert.ok(d.startsWith('M') && d.trim().endsWith('Z'), `${f} abre y cierra`);
    const numeros = d.match(/-?\d+(\.\d+)?/g).map(Number);
    assert.ok(numeros.length >= 6 && numeros.every(Number.isFinite), `${f}: números finitos`);
    // Cabe en la caja de 24 (los arcos del círculo son relativos: no se miden).
    if (f !== 'circulo') assert.ok(numeros.every((v) => v >= 0 && v <= P.CAJA), `${f} cabe en la caja`);
  }
  assert.equal(new Set(formas.map((f) => TRAZOS[f])).size, COLORES_MAX, 'ningún trazo se repite');
});

prueba('la meta más cerca de llenarse: la que ya avanzó y aún no se llena', () => {
  const m = (llevas, meta) => ({ llevas, meta });
  assert.equal(indiceMasCercana([]), -1);
  assert.equal(indiceMasCercana([m(0, 7), m(0, 7), m(0, 7)]), -1, 'nadie avanzó: ninguna lleva filo');
  assert.equal(indiceMasCercana([m(2, 7), m(5, 7), m(3, 7)]), 1);
  assert.equal(indiceMasCercana([m(7, 7), m(4, 7), m(0, 7)]), 1, 'una llena ya no cuenta: pasó a la pregunta');
  assert.equal(indiceMasCercana([m(3, 7), m(3, 7)]), 0, 'en un empate gana la primera');
  assert.equal(indiceMasCercana([m(2, 7), m(4, 9), m(3, 11)]), 1, 'se compara el avance, no las piezas');
  assert.equal(indiceMasCercana([m(1, 0)]), -1, 'una meta de 0 no rompe la cuenta');
});

// --- el símbolo blanco al 70 % contra el tono medio de cada tinte (WCAG 1.4.11: 3:1 para gráficos)
const lineal = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminancia = ([r, g, b]) => 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const tintes = [...tokens.matchAll(/\{ claro: '(#[0-9A-Fa-f]{6})', medio: '(#[0-9A-Fa-f]{6})', oscuro: '(#[0-9A-Fa-f]{6})' \}/g)].map((m) => ({
  claro: m[1],
  medio: m[2],
  oscuro: m[3],
}));
const simbolo = tokens.match(/simbolo: 'rgba\(255, 255, 255, ([0-9.]+)\)'/);

prueba('hay un tinte por color y cada uno es un degradado del mismo tono, del claro al oscuro', () => {
  assert.equal(tintes.length, COLORES_MAX);
  for (const t of tintes) {
    const [c, m, o] = [t.claro, t.medio, t.oscuro].map((h) => luminancia(hex(h)));
    assert.ok(c > m && m > o, `${t.medio}: claro > medio > oscuro`);
  }
});

prueba('el símbolo blanco al 70 % se distingue (3:1) de la cara en el tono medio de cada tinte', () => {
  assert.ok(simbolo, 'el token del símbolo existe');
  const alfa = Number(simbolo[1]);
  assert.equal(alfa, 0.7);
  for (const t of tintes) {
    const fondo = hex(t.medio);
    const visto = [255, 255, 255].map((v, i) => v * alfa + fondo[i] * (1 - alfa));
    assert.ok(contraste(visto, fondo) >= 3, `${t.medio}: ${contraste(visto, fondo).toFixed(2)}:1`);
  }
});

console.log(`\ncheck:dulces ${total} pruebas ok`);
