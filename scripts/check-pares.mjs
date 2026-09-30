/**
 * Prueba la geometría del tablero de Pares.
 *
 *   npm run check:pares
 *
 * geometria.ts no importa nada, así que se transpila en memoria con typescript y se
 * carga como módulo, sin jest.
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
const G = await cargar('src/features/juegos/pares/logic/geometria.ts');
const { columnasPara, distribuir, fichaEn, centroDe, ALTO_FICHA_MIN, ALTO_FICHA_MAX, HUECO_FICHAS } = G;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

const niveles = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/niveles.json'), 'utf8')).juegos.pares.niveles;
const PARES = [...new Set(niveles.map((n) => n.pares))].sort((a, b) => a - b);

prueba('columnas: 2 si caben con fichas de 72, y 3 si no', () => {
  assert.equal(columnasPara(8, 380), 2, '4 pares: 4 filas de 72 = 312');
  assert.equal(columnasPara(10, 380), 3, '5 pares: 5 filas de 72 = 392 no caben en 380');
  assert.equal(columnasPara(10, 460), 2, 'en un teléfono más alto, 5 pares caben en 2 columnas');
  assert.equal(columnasPara(16, 380), 3);
});

prueba('distribuir: las fichas llenan el alto sin bajar de 72 ni pasar de 104', () => {
  const chico = distribuir(8, 328, 380);
  assert.equal(chico.columnas, 2);
  assert.equal(chico.altoFicha, Math.floor((380 - HUECO_FICHAS * 3) / 4), 'llena el alto: 89');
  assert.ok(chico.altoFicha >= ALTO_FICHA_MIN && chico.altoFicha <= ALTO_FICHA_MAX);
  const alto = distribuir(8, 328, 700);
  assert.equal(alto.altoFicha, ALTO_FICHA_MAX, 'con mucho espacio no se estira más de 104');
  assert.equal(alto.desborda, false);
});

prueba('distribuir: cuándo el tablero desborda y hay que scrollear', () => {
  assert.equal(distribuir(16, 328, 380).desborda, true, '8 pares a 640 dp: 6 filas de 72 no caben');
  assert.equal(distribuir(16, 328, 380).altoFicha, ALTO_FICHA_MIN);
  assert.equal(distribuir(16, 328, 380).altoContenido, 6 * 72 + 5 * 8);
  assert.equal(distribuir(8, 328, 380).desborda, false);
  assert.equal(distribuir(12, 328, 380).desborda, false, '6 pares en 3 columnas: 4 filas');
});

prueba('las fichas no se pisan, caben en el ancho y van en orden de lectura', () => {
  for (const pares of PARES) {
    for (const disponible of [300, 380, 450, 560, 700]) {
      const d = distribuir(pares * 2, 328, disponible);
      assert.equal(d.rectas.length, pares * 2);
      for (const r of d.rectas) {
        assert.ok(r.x >= 0 && r.x + r.width <= 328 + 1e-9, `${pares} pares: cabe en el ancho`);
        assert.ok(r.y >= 0 && r.y + r.height <= d.altoContenido + 1e-9);
        assert.ok(r.width > 0 && r.height >= ALTO_FICHA_MIN);
      }
      for (let i = 0; i < d.rectas.length; i++) {
        for (let j = i + 1; j < d.rectas.length; j++) {
          const a = d.rectas[i];
          const b = d.rectas[j];
          const separadas = a.x + a.width <= b.x + 1e-9 || b.x + b.width <= a.x + 1e-9 || a.y + a.height <= b.y + 1e-9 || b.y + b.height <= a.y + 1e-9;
          assert.ok(separadas, `${pares} pares @${disponible}: ${i} y ${j} no se pisan`);
        }
      }
      // Orden de lectura: cada ficha va después de la anterior en su fila o en otra más abajo.
      for (let i = 1; i < d.rectas.length; i++) {
        const antes = d.rectas[i - 1];
        const ahora = d.rectas[i];
        assert.ok(ahora.y > antes.y || (ahora.y === antes.y && ahora.x > antes.x), 'lectura de izquierda a derecha y de arriba abajo');
      }
      assert.ok(d.columnas === 2 || d.columnas === 3);
    }
  }
});

prueba('los niveles reales de Pares (4 a 8 pares) a 360 x 640', () => {
  assert.deepEqual(PARES, [4, 5, 6, 7, 8]);
  const esperado = { 4: [2, false], 5: [3, false], 6: [3, false], 7: [3, true], 8: [3, true] };
  for (const pares of PARES) {
    const d = distribuir(pares * 2, 328, 380);
    assert.deepEqual([d.columnas, d.desborda], esperado[pares], `${pares} pares`);
  }
});

prueba('qué ficha hay bajo un dedo', () => {
  const d = distribuir(8, 328, 380);
  d.rectas.forEach((r, i) => {
    const c = centroDe(r);
    assert.equal(fichaEn(d.rectas, c.x, c.y), i, `el centro de la ${i}`);
    assert.equal(fichaEn(d.rectas, r.x + 0.5, r.y + 0.5), i, 'la esquina de adentro');
  });
  const hueco = d.rectas[0].x + d.rectas[0].width + HUECO_FICHAS / 2;
  assert.equal(fichaEn(d.rectas, hueco, 10), -1, 'un dedo en el hueco no toca ninguna');
  assert.equal(fichaEn(d.rectas, -5, -5), -1);
  assert.equal(fichaEn(d.rectas, 9999, 9999), -1);
  assert.equal(fichaEn([], 1, 1), -1);
});

prueba('entradas raras no rompen la geometría', () => {
  const d = distribuir(0, 328, 380);
  assert.deepEqual(d.rectas, []);
  const raro = distribuir(8, 0, Number.NaN);
  assert.equal(raro.rectas.length, 8);
  assert.ok(raro.rectas.every((r) => Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.height)));
});

console.log(`\ncheck:pares ${total} pruebas ok`);
