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

prueba('las 1,524 frases con el marco de imagen obligatorio (16:9): a 640 dp todas necesitan scroll, a ~800 dp ninguna', () => {
  assert.equal(entradas.length, 1524);
  const ANCHO = 294;
  const casos = [
    { alto: 380, etiqueta: '640 dp (chico)' },
    { alto: 460, etiqueta: '~700 dp' },
    { alto: 540, etiqueta: '~800 dp' },
  ];
  const desbordanA = (alto) =>
    entradas.filter((e) => {
      const d = M.elegirDensidad(e, ANCHO, alto);
      return M.desborda(alto, M.alturaEstimada(e, ANCHO, d));
    }).length;
  for (const { alto, etiqueta } of casos) {
    const porDensidad = { normal: 0, compacta: 0, minima: 0 };
    for (const e of entradas) porDensidad[M.elegirDensidad(e, ANCHO, alto)]++;
    const desb = desbordanA(alto);
    console.log(
      `        a ${ANCHO}×${alto} (${etiqueta}): normal ${porDensidad.normal}, compacta ${porDensidad.compacta}, ` +
        `mínima ${porDensidad.minima}; con scroll ${Math.round((desb / entradas.length) * 100)} %`
    );
  }
  // El marco de 16:9 al ancho de la carta no cabe junto al resto en un teléfono chico: la carta pasa a
  // permitir scroll ahí (decisión explícita, no un bug). En uno grande no hace falta ninguna vez.
  assert.equal(desbordanA(380), entradas.length, 'a 380 dp el marco obligatorio hace que todas necesiten scroll');
  assert.equal(desbordanA(540), 0, 'a 540 dp ninguna necesita scroll');
});

prueba('el marco de imagen mide 16:9 al ancho de la carta, con imagen o sin ella', () => {
  assert.ok(Math.abs(M.alturaImagen(294) / 294 - 9 / 16) < 1e-9);
  assert.ok(Math.abs(M.alturaImagen(320) / 320 - 9 / 16) < 1e-9);
});

prueba('desborda: cabe justo al límite, se pasa un dp más', () => {
  const e = entradas.find((x) => x.phrase.length < 20 && !x.note && x.vulgaridad === 0);
  const h = M.alturaEstimada(e, 294);
  assert.equal(M.desborda(h, h), false);
  assert.equal(M.desborda(h - 1, h), true);
});

/* ---------- lo que se puede revisar sin teléfono ---------- */

const sinComentarios = (codigo) => codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

prueba('la pantalla: sin contador, con la nota, con el mismo pedido de 60 y guardar como Detalle (estado real, botón secondary)', () => {
  const pantalla = sinComentarios(leer('src/features/frases-sueltas/screens/AzarScreen.tsx'));
  assert.ok(!/contador|setVistas|vistas/.test(pantalla), 'el contador de arriba se fue');
  assert.match(pantalla, /Aquí no se lleva cuenta de nada\. Solo pasa frases\./, 'la nota se queda');
  assert.match(pantalla, /getRandomEntries\(filter\(\), 60\)/, 'la baraja se pide igual');
  assert.match(pantalla, /toggleFavorite\(user\.id, entry\.id\)/, 'guardar sigue usando toggleFavorite');
  assert.match(pantalla, /isFavorite\(user\.id, entryId\)/, 'lee el estado real como Detalle');
  assert.match(pantalla, /<BotonGuardar\s+variante="secondary"/, 'el botón de guardar no compite con «Siguiente»');
  assert.match(pantalla, /<Button\s+label="Siguiente"\s+icon="arrow-right"\s+iconAlFinal/, '«Siguiente» lleva texto y la flecha al final');
  assert.ok(!/'guardar'|'guardada'/.test(pantalla), 'sin «guardar» en minúscula');
  assert.ok(!/saveCardState|recordReview|calificar/i.test(pantalla), 'aquí no se guarda progreso');
});

prueba('la carta: frase en text con karaoke (no en accent), IPA centrado, grupos segmentados y acciones del lector', () => {
  const carta = sinComentarios(leer('src/features/frases-sueltas/components/CartaFrase.tsx'));
  assert.match(carta, /<FraseKaraoke palabras=\{palabras\} voz=\{voz\}/);
  assert.ok(!/color\.accent/.test(carta), 'el accent queda para lo que se toca');
  assert.match(carta, /ipa: \{[^}]*textAlign: 'center'/, 'el IPA lleva su textAlign');
  for (const e of ['Escuchar', 'Lento', 'Español', 'Inglés y español']) assert.match(carta, new RegExp(`etiqueta: '${e}'`));
  assert.ok(!/Ambos/.test(carta), '«Ambos» ya no existe');
  assert.match(carta, /accessibilityActions=\{acciones\}/);
  assert.match(carta, /name: 'siguiente', label: 'Siguiente'/);
  assert.match(carta, /name: 'guardar'/);
  assert.match(carta, /useVozEnVivo\(activa \? entry\.audio_en : null\)/, 'solo la carta de arriba escucha voces');
  assert.ok(!/iniciales/i.test(carta), 'sin iniciales');
});

prueba('el mazo: solo tres cartas, el umbral sale de mazo.ts, se asoman detrás, la que sube y la que sale cambian en el mismo cuadro y no hay abanico ni gesto con reducir movimiento', () => {
  const mazo = sinComentarios(leer('src/features/frases-sueltas/components/MazoCartas.tsx'));
  assert.match(mazo, /indicesVisibles\(actual, entradas\.length\)/, 'solo se montan las cartas de indicesVisibles');
  assert.match(mazo, /decidirGesto\(tx\.value, ty\.value, e\.velocityX, e\.velocityY\)/, 'el umbral sale de mazo.ts');
  assert.match(mazo, /transformOrigin: '50% 100%'/, 'las de atrás conservan el borde de abajo: por eso se asoman');
  assert.match(mazo, /topIdx\.value = n \+ 1;\s*tx\.value = 0;\s*ty\.value = 0;\s*rot\.value = 0;/, 'la de atrás pasa a ser la de arriba y el dedo vuelve a cero a la vez');
  assert.match(mazo, /regresar\(\);/, 'si no pasa el umbral regresa con resorte');
  assert.match(mazo, /withSpring\(0, motionSpring\.rebote\)/);
  assert.match(mazo, /if \(g === 'guardar'\) runOnJS\(guardado\)\(\);\s*regresar\(\);/, 'guardar no pasa a la siguiente: la carta regresa');
  assert.match(mazo, /cancelAnimation\(pos\);/, 'al desmontar se sueltan las animaciones');
  const fin = mazo.indexOf('const pila = ');
  const reducido = mazo.slice(mazo.lastIndexOf('if (reducido) {', fin), fin);
  assert.ok(reducido.length > 100 && !/GestureDetector|IndicadorArrastre|abre/.test(reducido), 'con reducir movimiento no hay gesto, indicador ni abanico');
  assert.match(reducido, /aparecerRapido\(\)/, 'la carta cambia con un fundido de 150 ms');
  const motion = leer('src/theme/motion.ts');
  const dur = (nombre) => Number(motion.match(new RegExp(`${nombre}: (\\d+),`))?.[1]);
  assert.match(motion, /export const aparecerRapido = \(\) => FadeIn\.duration\(motionDuration\.rapido\)/);
  assert.equal(dur('rapido'), 150);
  const bloque = motion.slice(motion.indexOf('export const motionMazo'));
  assert.match(bloque, /abre: motionDuration\.base,\s*junta: motionDuration\.lento,\s*escalon: 60,/);
  const abanico = dur('base') + dur('lento') + 60 * (M.MAZO.cartas - 1);
  assert.ok(abanico <= 700, `el abanico dura ${abanico} ms y no debe pasar de 700`);
});

prueba('el mazo vacío y el foco: al acabarse las 60 se ve vacío y se pide otra baraja; perder el foco corta la voz', () => {
  const mazo = leer('src/features/frases-sueltas/components/MazoCartas.tsx');
  assert.match(mazo, /export function MazoVacio\(\)/);
  assert.match(mazo, /<BordePunteado/);
  assert.match(mazo, /Barajando…/);
  const pantalla = sinComentarios(leer('src/features/frases-sueltas/screens/AzarScreen.tsx'));
  assert.match(pantalla, /setBarajando\(true\);\s*setPool\(\[\]\);\s*void cargar\(\);/, 'la baraja nueva se pide con la misma carga');
  assert.match(pantalla, /<MazoVacio \/>/);
  assert.match(pantalla, /useFocusEffect\(|useCortarAudioAlSalir\(/);
  assert.match(pantalla, /key=\{tanda\}/, 'cada baraja arma un mazo nuevo');
  assert.match(pantalla, /if \(guardada\) haptics\.tapLight\(\);\s*else void alternarGuardada\(\);/, 'deslizar arriba nunca quita una frase guardada');
});

console.log(`\ncheck:mazo ${total} pruebas ok\n`);
