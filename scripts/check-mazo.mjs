/**
 * Prueba lo puro del mazo de Frases sueltas:
 *
 *   npm run check:mazo
 *
 *  - cuándo un deslizamiento cuenta como «Siguiente» o «Guardar» (distancia, velocidad, eje, lo que no cuenta);
 *  - el giro, la resistencia y cómo se asoman las cartas de atrás;
 *  - el tamaño de la frase y la densidad de la carta contra las 1,524 frases reales (que toda quepa en un teléfono
 *    de 640 dp de alto y a cuántas les sobra lugar para la imagen);
 *  - lo que se puede revisar sin teléfono de la pantalla y de las cartas.
 *
 * mazo.ts no importa nada: se transpila en memoria con typescript, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const existe = (rel) => fs.existsSync(path.join(ROOT, rel));
const cargar = async (rel) => {
  const js = ts.transpileModule(leer(rel), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};

const M = await cargar('src/domain/mazo.ts');
const entradas = JSON.parse(leer('assets/data/catalogo.json')).entries;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

/* ---------- el gesto ---------- */

prueba('a la izquierda: pasa por distancia (96 dp) o por velocidad (800 dp/s), lo que llegue primero', () => {
  assert.equal(M.decidirGesto(-95, 0, 0, 0), 'volver', 'a 95 dp sin velocidad regresa');
  assert.equal(M.decidirGesto(-96, 0, 0, 0), 'siguiente');
  assert.equal(M.decidirGesto(-140, 10, -50, 0), 'siguiente', 'lento pero lejos');
  assert.equal(M.decidirGesto(-30, 0, -800, 0), 'siguiente', 'corto pero rápido');
  assert.equal(M.decidirGesto(-30, 0, -799, 0), 'volver', 'corto y no tan rápido');
});

prueba('hacia arriba: guarda por distancia (96 dp) o por velocidad (900 dp/s)', () => {
  assert.equal(M.decidirGesto(0, -95, 0, 0), 'volver');
  assert.equal(M.decidirGesto(0, -96, 0, 0), 'guardar');
  assert.equal(M.decidirGesto(5, -30, 0, -900), 'guardar');
  assert.equal(M.decidirGesto(5, -30, 0, -899), 'volver');
});

prueba('a la derecha y hacia abajo solo resisten: por lejos o rápido que vayan, regresan', () => {
  for (const [dx, dy, vx, vy] of [
    [200, 0, 2000, 0],
    [0, 200, 0, 2000],
    [-10, 150, -100, 1800],
    [120, -10, 1500, 0],
  ]) {
    assert.equal(M.decidirGesto(dx, dy, vx, vy), 'volver', `${dx},${dy},${vx},${vy}`);
  }
});

prueba('el eje lo decide el que pesa más: un arrastre diagonal no cuenta dos veces', () => {
  assert.equal(M.decidirGesto(-100, -60, 0, 0), 'siguiente');
  assert.equal(M.decidirGesto(-60, -100, 0, 0), 'guardar');
  assert.equal(M.decidirGesto(-100, -100, 0, 0), 'siguiente', 'con empate gana la izquierda');
  assert.equal(M.decidirGesto(-40, -30, -900, -100), 'siguiente', 'la velocidad inclina la balanza');
  assert.equal(M.decidirGesto(-30, -40, -100, -950), 'guardar');
});

prueba('mientras se arrastra: el avance de cada indicador sube a 1 en el umbral y solo enciende el eje que va', () => {
  assert.equal(M.avanceSiguiente(-48, 0), 0.5);
  assert.equal(M.avanceSiguiente(-300, 0), 1);
  assert.equal(M.avanceSiguiente(50, 0), 0);
  assert.equal(M.avanceSiguiente(-40, -80), 0, 'va más arriba que a la izquierda');
  assert.equal(M.avanceGuardar(0, -48), 0.5);
  assert.equal(M.avanceGuardar(0, -300), 1);
  assert.equal(M.avanceGuardar(0, 50), 0);
  assert.equal(M.avanceGuardar(-80, -40), 0);
  for (const [dx, dy] of [[-96, -96], [-50, -50], [-10, -12], [-200, -199]]) {
    assert.ok(M.avanceSiguiente(dx, dy) === 0 || M.avanceGuardar(dx, dy) === 0, `${dx},${dy}: nunca se encienden los dos`);
  }
});

prueba('la resistencia y el giro: ceden un cuarto hacia donde no van y el giro crece con la velocidad hasta 18°', () => {
  assert.equal(M.amortiguar(-80), -80);
  assert.equal(M.amortiguar(80), 20);
  assert.equal(M.giroDeSalida(0), -0.35 * 18, 'hasta la salida más lenta se inclina');
  assert.equal(M.giroDeSalida(-2400), -18);
  assert.equal(M.giroDeSalida(-9000), -18, 'no pasa de 18°');
  assert.ok(M.giroDeSalida(-1200) < M.giroDeSalida(-600), 'más rápido, más giro');
  assert.ok(M.giroDeSalida(-1200) <= 0, 'sale girando contra el reloj');
  assert.equal(M.giroDeArrastre(1000), 18);
  assert.equal(M.giroDeArrastre(-1000), -18);
  assert.equal(M.giroDeArrastre(0), 0);
});

/* ---------- el mazo ---------- */

prueba('el mazo: dos cartas se asoman 8 y 16 dp, a 0.96 y 0.92 y con menos opacidad; a mitad de camino, a mitad de valor', () => {
  assert.deepEqual([0, 1, 2].map(M.bajaDeProfundidad), [0, 8, 16]);
  assert.deepEqual([0, 1, 2].map((d) => Number(M.escalaDeProfundidad(d).toFixed(2))), [1, 0.96, 0.92]);
  const op = [0, 1, 2].map(M.opacidadDeProfundidad);
  assert.equal(op[0], 1);
  assert.ok(op[0] > op[1] && op[1] > op[2] && op[2] > 0, 'cada una más tenue');
  assert.equal(M.bajaDeProfundidad(0.5), 4);
  assert.equal(M.bajaDeProfundidad(-1), 0, 'la que ya salió no sube');
  assert.equal(M.bajaDeProfundidad(9), 16, 'ni la de más atrás baja de más');
});

prueba('solo se montan tres cartas, y menos al llegar al final de la baraja', () => {
  assert.deepEqual(M.indicesVisibles(0, 60), [0, 1, 2]);
  assert.deepEqual(M.indicesVisibles(30, 60), [30, 31, 32]);
  assert.deepEqual(M.indicesVisibles(58, 60), [58, 59]);
  assert.deepEqual(M.indicesVisibles(59, 60), [59]);
  assert.deepEqual(M.indicesVisibles(60, 60), [], 'baraja vacía: no hay cartas');
  assert.deepEqual(M.indicesVisibles(0, 0), []);
  assert.equal(M.MAZO.cartas, 3);
});

/* ---------- las frases reales ---------- */

prueba('la frase: lg hasta 40 caracteres, md hasta 80 y h3 el resto; en la densidad mínima baja un tamaño', () => {
  assert.equal(M.tamanoFrase(40), 'lg');
  assert.equal(M.tamanoFrase(41), 'md');
  assert.equal(M.tamanoFrase(80), 'md');
  assert.equal(M.tamanoFrase(81), 'h3');
  assert.equal(M.tamanoFrase(20, 'minima'), 'md');
  assert.equal(M.tamanoFrase(60, 'minima'), 'h3');
  assert.equal(M.tamanoFrase(120, 'minima'), 'h3');
  const cuenta = { lg: 0, md: 0, h3: 0 };
  for (const e of entradas) cuenta[M.tamanoFrase(e.phrase.length)]++;
  assert.equal(cuenta.lg + cuenta.md + cuenta.h3, entradas.length);
  assert.ok(cuenta.lg / entradas.length > 0.7, 'la mayoría va en el tamaño grande');
});

prueba('las 1,524 frases caben en una carta de un teléfono de 640 dp (380 dp de alto, 294 de ancho): ninguna se sale', () => {
  assert.equal(entradas.length, 1524);
  const ANCHO = 294;
  const ALTO = 380;
  const porDensidad = { normal: 0, compacta: 0, minima: 0 };
  let conImagen = 0;
  for (const e of entradas) {
    const d = M.elegirDensidad(e, ANCHO, ALTO);
    porDensidad[d]++;
    const alto = M.alturaEstimada(e, ANCHO, d);
    assert.ok(alto <= ALTO, `#${e.id} «${e.phrase}» mide ${alto.toFixed(0)} dp aun en la densidad ${d}`);
    if (M.cabeImagen(ALTO, alto, d)) conImagen++;
  }
  assert.ok(porDensidad.normal / entradas.length > 0.8, 'la mayoría cabe con el aire de siempre');
  console.log(
    `        a ${ANCHO}×${ALTO}: normal ${porDensidad.normal}, compacta ${porDensidad.compacta}, mínima ${porDensidad.minima}; ` +
      `con imagen ${Math.round((conImagen / entradas.length) * 100)} %`
  );
});

prueba('la imagen solo va si sobran 96 dp más el aire; una carta más alta la admite más veces', () => {
  const e = entradas.find((x) => x.phrase.length < 20 && !x.note && x.vulgaridad === 0);
  const h = M.alturaEstimada(e, 294);
  assert.equal(M.cabeImagen(h + 96 + 12 - 1, h), false);
  assert.equal(M.cabeImagen(h + 96 + 12, h), true);
  const cuantas = (alto) =>
    entradas.filter((x) => {
      const d = M.elegirDensidad(x, 294, alto);
      return M.cabeImagen(alto, M.alturaEstimada(x, 294, d), d);
    }).length;
  assert.ok(cuantas(460) > cuantas(400) && cuantas(400) > cuantas(380));
});

/* ---------- lo que se puede revisar sin teléfono ---------- */

prueba('el mazo existe y sigue las reglas: 3 cartas, el gesto solo con movimiento, botones que hacen lo mismo y sin contador', () => {
  if (!existe('src/components/mazo/MazoCartas.tsx')) return;
  const mazo = leer('src/components/mazo/MazoCartas.tsx');
  assert.match(mazo, /indicesVisibles\(/, 'solo se montan las cartas de indicesVisibles');
  assert.match(mazo, /decidirGesto\(/, 'el umbral sale de mazo.ts');
  assert.match(mazo, /useMovimientoReducido/);
  const pantalla = leer('src/screens/extras/AzarScreen.tsx');
  assert.ok(!/contador|setVistas|vistas/.test(pantalla), 'el contador de arriba se fue');
  assert.match(pantalla, /Aquí no se lleva cuenta de nada\. Solo pasa frases\./, 'la nota se queda');
  assert.match(pantalla, /toggleFavorite/, 'guardar sigue usando toggleFavorite');
  assert.match(pantalla, /getRandomEntries\(filter\(\), 60\)/, 'la baraja se pide igual');
});

console.log(`\ncheck:mazo ${total} pruebas ok\n`);
