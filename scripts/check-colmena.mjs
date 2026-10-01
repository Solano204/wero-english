/**
 * Prueba lo puro de Colmena: la forma de las palabras, las ranuras por palabra y el panal de hexágonos.
 *
 *   npm run check:colmena
 *
 * geometria.ts y text.ts no importan nada; colmena.ts solo trae `shuffle`, que aquí no se usa, así que se
 * transpilan en memoria con typescript y se cargan como módulos, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const cargar = async (rel, sustituir = (s) => s) => {
  const fuente = sustituir(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const G = await cargar('src/features/juegos/colmena/logic/geometria.ts');
const { formaPalabras } = await cargar('src/domain/texto.ts');
const { normaliza } = await cargar('src/domain/colmena.ts', (s) => s.replace(/import \{ shuffle \} from '@\/domain\/arreglos';/, 'const shuffle = (a) => a;'));
const { distribuirRanuras, disposicionPanal, ordenDesdeCentro, fichasParaCompletar, retrasoVuelo, etiquetaRanura, puntosHexagono } = G;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

const catalogo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/catalogo.json'), 'utf8'));
const entradas = Array.isArray(catalogo) ? catalogo : Object.values(catalogo).find(Array.isArray);
const usables = entradas.filter((e) => {
  const n = normaliza(e.phrase_tts ?? '').length;
  return n >= 4 && n <= 22;
});

// El ancho de un teléfono de 360 dp con los 16 dp de margen de cada lado; los espacios son los de `space`.
const ANCHO = 328;
const RANURAS = { hueco: 4, entrePalabras: 16, entreLineas: 8, anchoBase: 32, altoBase: 40, anchoMin: 12 };
const PANAL = { toqueMin: 48, hueco: 5 };

const mulberry32 = (semilla) => () => {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

prueba('formaPalabras: los espacios separan pero no cuentan, y un trozo sin letras no es palabra', () => {
  assert.deepEqual(formaPalabras('gotta chill out on here'), [5, 5, 3, 2, 4]);
  assert.deepEqual(formaPalabras("I'm a D1 rage baiter"), [3, 1, 1, 4, 6]);
  assert.deepEqual(formaPalabras('Some 2020'), [4]);
  assert.deepEqual(formaPalabras('  a   b '), [1, 1]);
  assert.deepEqual(formaPalabras('Are we gonna slop, bro?'), [3, 2, 5, 4, 3]);
  assert.deepEqual(formaPalabras(''), []);
});

prueba(`formaPalabras suma lo mismo que el objetivo de la ronda en las ${usables.length} frases usables`, () => {
  assert.ok(usables.length > 800, 'el catálogo trae las frases');
  for (const e of usables) {
    const forma = formaPalabras(e.phrase_tts);
    assert.equal(
      forma.reduce((a, n) => a + n, 0),
      normaliza(e.phrase_tts).length,
      `«${e.phrase_tts}»`
    );
    assert.ok(forma.every((n) => n > 0));
  }
});

prueba('ranuras: cada frase real cabe en 360 px, con todas las letras y sin partir ninguna palabra', () => {
  for (const e of usables) {
    const forma = formaPalabras(e.phrase_tts);
    const d = distribuirRanuras(forma, ANCHO, RANURAS);
    const cual = `«${e.phrase_tts}»`;
    assert.equal(d.desborda, false, cual);
    assert.equal(d.ranuras.length, normaliza(e.phrase_tts).length, cual);
    for (const r of d.ranuras) {
      assert.ok(r.x >= 0 && r.x + d.ranuraAncho <= ANCHO + 1e-6, `${cual}: se sale del ancho`);
    }
    forma.forEach((n, p) => {
      const suyas = d.ranuras.filter((r) => r.palabra === p);
      assert.equal(suyas.length, n, cual);
      assert.equal(new Set(suyas.map((r) => r.y)).size, 1, `${cual}: la palabra ${p + 1} se parte entre líneas`);
      suyas.forEach((r, l) => assert.equal(r.letra, l));
    });
    assert.ok(d.ranuraAncho <= 32 && d.ranuraAncho >= 12, cual);
  }
});

prueba('ranuras: entre dos palabras de una línea hay al menos el espacio de palabras, y las líneas van una bajo otra', () => {
  for (const e of usables) {
    const d = distribuirRanuras(formaPalabras(e.phrase_tts), ANCHO, RANURAS);
    d.palabras.forEach((p, i) => {
      const sig = d.palabras[i + 1];
      if (!sig) return;
      if (sig.y === p.y) assert.ok(sig.x - (p.x + p.ancho) >= RANURAS.entrePalabras - 1e-6, `«${e.phrase_tts}»`);
      else assert.ok(sig.y >= p.y + d.ranuraAlto + RANURAS.entreLineas - 1e-6);
    });
    assert.ok(d.alto >= d.ranuraAlto);
  }
});

prueba('ranuras: solo se encogen las frases con una palabra larga, y todas a la vez', () => {
  const normal = distribuirRanuras([5, 5, 3, 2, 4], ANCHO, RANURAS);
  assert.equal(normal.ranuraAncho, 32);
  assert.equal(normal.ranuraAlto, 40);
  const larga = distribuirRanuras(formaPalabras('confidentiality'), ANCHO, RANURAS);
  assert.ok(larga.ranuraAncho < 32 && larga.ranuraAncho >= 12, `15 letras: ${larga.ranuraAncho}`);
  assert.equal(larga.lineas, 1);
  const tope = distribuirRanuras([22], ANCHO, RANURAS);
  assert.equal(tope.desborda, false, 'una sola palabra de 22 letras');
  assert.ok(tope.ranuraAncho >= 12);
  const mas = distribuirRanuras([9, 9, 9], ANCHO, RANURAS);
  assert.ok(mas.lineas >= 2, 'tres palabras de 9 no caben en una línea');
});

prueba('ranuras: sin palabras no hay nada que dibujar', () => {
  const d = distribuirRanuras([], ANCHO, RANURAS);
  assert.equal(d.alto, 0);
  assert.equal(d.ranuras.length, 0);
});

prueba('etiquetaRanura: el ejemplo del prompt', () => {
  assert.equal(etiquetaRanura(0, 5, 2, 5, null), 'Palabra 1 de 5, letra 3 de 5, vacía');
  assert.equal(etiquetaRanura(2, 5, 0, 3, 't'), 'Palabra 3 de 5, letra 1 de 3, t');
});

prueba('panal: de 1 a 26 fichas caben en 360 px, sin encimarse y con 48 dp de área táctil', () => {
  for (const ancho of [ANCHO, 296]) {
    for (let n = 1; n <= 26; n++) {
      const p = disposicionPanal(n, ancho, PANAL);
      const cual = `n=${n}, ancho=${ancho}`;
      assert.equal(p.hexagonos.length, n, cual);
      assert.ok(p.hexAncho >= 48 && p.pasoY >= 48, `${cual}: área táctil ${p.hexAncho} × ${p.pasoY}`);
      for (const h of p.hexagonos) assert.ok(h.x >= -1e-6 && h.x + p.hexAncho <= ancho + 1e-6, `${cual}: se sale del ancho`);
      const centros = p.hexagonos.map((h) => [h.x + p.hexAncho / 2, h.y + p.hexAlto / 2]);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const d = Math.hypot(centros[i][0] - centros[j][0], centros[i][1] - centros[j][1]);
          assert.ok(d >= p.pasoX - 1e-6, `${cual}: ${i} y ${j} se encimarían (${d.toFixed(1)} < ${p.pasoX.toFixed(1)})`);
        }
      }
      assert.ok(Math.max(...p.hexagonos.map((h) => h.y + p.hexAlto)) <= p.alto + 1e-6, cual);
    }
  }
});

prueba('panal: 22 letras y 4 señuelos hacen cinco filas de seis o cinco, en unos 250 dp', () => {
  const p = disposicionPanal(26, ANCHO, PANAL);
  assert.equal(p.columnas, 6);
  assert.equal(p.filas, 5);
  assert.ok(p.alto <= 255, `alto ${p.alto}`);
  const cuenta = new Map();
  for (const h of p.hexagonos) cuenta.set(h.y, (cuenta.get(h.y) ?? 0) + 1);
  assert.deepEqual([...cuenta.values()], [6, 5, 6, 5, 4]);
});

prueba('panal: las filas alternan y se acomodan sobre la misma retícula', () => {
  const p = disposicionPanal(14, ANCHO, PANAL);
  const filas = new Map();
  for (const h of p.hexagonos) filas.set(h.y, [...(filas.get(h.y) ?? []), h.x]);
  const claves = [...filas.keys()].sort((a, b) => a - b);
  const origen = Math.min(...p.hexagonos.map((h) => h.x));
  claves.forEach((y, r) => {
    assert.ok(Math.abs(y - r * p.pasoY) < 1e-6, 'cada fila a un paso de la anterior');
    // Todas las fichas caen en la retícula: una fila par en pasos enteros desde el borde y una impar en medios pasos.
    for (const x of filas.get(y)) {
      const pasos = (x - origen) / p.pasoX;
      const resto = Math.abs(pasos - Math.round(pasos * 2) / 2);
      assert.ok(resto < 1e-6, `fila ${r}: fuera de la retícula`);
    }
  });
  const enFila = (r) => filas.get(claves[r]);
  for (let r = 1; r < claves.length; r++) {
    // Dos filas vecinas no pueden tener fichas una sobre otra: van corridas medio paso.
    for (const a of enFila(r - 1)) {
      for (const b of enFila(r)) {
        const medios = Math.abs(a - b) / (p.pasoX / 2);
        assert.ok(Math.abs(medios - Math.round(medios)) < 1e-6 && Math.round(medios) % 2 === 1, `filas ${r - 1} y ${r}: fichas una sobre otra`);
      }
    }
  }
});

prueba('puntosHexagono: seis vértices con punta arriba, simétricos y dentro de la caja', () => {
  const puntos = puntosHexagono(20, 23).split(' ').map((p) => p.split(',').map(Number));
  assert.equal(puntos.length, 6);
  assert.deepEqual(puntos[0], [10, 0]);
  assert.deepEqual(puntos[3], [10, 23]);
  for (const [x, y] of puntos) assert.ok(x >= 0 && x <= 20 && y >= 0 && y <= 23);
  assert.equal(puntos[1][0], 20);
  assert.equal(puntos[5][0], 0);
  assert.ok(Math.abs(puntos[1][1] - (23 - puntos[2][1])) < 0.02, 'simétrico de arriba abajo');
  const adentro = puntosHexagono(20, 23, 1).split(' ').map((p) => p.split(',').map(Number));
  assert.ok(adentro.every(([x, y]) => x >= 1 && x <= 19 && y >= 1 && y <= 22), 'el margen los mete hacia adentro');
});

prueba('panal: el orden del centro hacia afuera es una permutación y empieza por el más central', () => {
  for (const n of [1, 4, 10, 17, 26]) {
    const p = disposicionPanal(n, ANCHO, PANAL);
    const rango = ordenDesdeCentro(p.hexagonos, p.hexAncho, p.hexAlto);
    assert.deepEqual([...rango].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
    const cx = p.hexagonos.reduce((s, h) => s + h.x + p.hexAncho / 2, 0) / n;
    const cy = p.hexagonos.reduce((s, h) => s + h.y + p.hexAlto / 2, 0) / n;
    const dist = (h) => Math.hypot(h.x + p.hexAncho / 2 - cx, h.y + p.hexAlto / 2 - cy);
    const primero = p.hexagonos[rango.indexOf(0)];
    assert.ok(p.hexagonos.every((h) => dist(primero) <= dist(h) + 1e-6));
  }
  assert.deepEqual(ordenDesdeCentro([], 50, 58), []);
});

prueba('fichasParaCompletar: una ficha libre por cada letra que falta, y con su letra', () => {
  const rand = mulberry32(7);
  const azar = (n) => Math.floor(rand() * n);
  for (const e of usables.slice(0, 400)) {
    const objetivo = normaliza(e.phrase_tts);
    const senuelos = Array.from({ length: 2 + azar(3) }, () => 'aeioubcdfg'[azar(10)]);
    const letras = [...objetivo, ...senuelos].sort(() => rand() - 0.5);
    // Se arma un prefijo con fichas cualquiera que tengan la letra que toca, como haría quien juega.
    const desde = azar(objetivo.length + 1);
    const usadas = [];
    for (let k = 0; k < desde; k++) {
      const libres = letras.map((l, i) => (l === objetivo[k] && !usadas.includes(i) ? i : -1)).filter((i) => i >= 0);
      usadas.push(libres[azar(libres.length)]);
    }
    const fichas = fichasParaCompletar(letras, usadas, objetivo, desde);
    const cual = `«${objetivo}» desde ${desde}`;
    assert.equal(fichas.length, objetivo.length - desde, cual);
    assert.equal(new Set(fichas).size, fichas.length, `${cual}: fichas repetidas`);
    fichas.forEach((f, j) => {
      assert.ok(!usadas.includes(f), `${cual}: reusa una ficha ya puesta`);
      assert.equal(letras[f], objetivo[desde + j], cual);
    });
  }
});

prueba('retrasoVuelo: 40 ms entre fichas y nunca más de 400 ms en total', () => {
  assert.equal(retrasoVuelo(0, 5), 0);
  assert.equal(retrasoVuelo(3, 8), 120);
  for (let n = 1; n <= 26; n++) assert.ok(retrasoVuelo(n - 1, n) <= 400, `n=${n}`);
  assert.equal(retrasoVuelo(4, 20), 80);
});

console.log(`\ncheck:colmena ${total} pruebas ok`);
