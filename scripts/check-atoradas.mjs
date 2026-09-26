/**
 * Prueba lo puro de Mi mazo y Se me atoran:
 *
 *   npm run check:atoradas
 *
 *  - Mi mazo: cuándo un deslizamiento cuenta como «Quitar», y que quitar y deshacer dejan la lista como estaba;
 *  - lo que se puede revisar sin teléfono de las pantallas y de sus piezas (aviso de 5 s, acciones del lector,
 *    reducir movimiento, sin rojo) y que no se toca lo que no debe (el orden, `toggleFavorite`, SM-2).
 *
 * guardadas.ts no importa nada: se transpila en memoria con typescript, sin jest.
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
const sinComentarios = (codigo) => codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const G = await cargar('src/domain/guardadas.ts');

let total = 0;
const prueba = async (nombre, fn) => {
  await fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

/* ---------- Mi mazo: el gesto ---------- */

await prueba('quitar: pasa por distancia (96 dp) o por velocidad (800 dp/s), lo que llegue primero; a la derecha regresa', () => {
  assert.equal(G.decidirQuitar(-95, 0), 'volver');
  assert.equal(G.decidirQuitar(-96, 0), 'quitar');
  assert.equal(G.decidirQuitar(-140, -50), 'quitar', 'lento pero lejos');
  assert.equal(G.decidirQuitar(-30, -800), 'quitar', 'corto pero rápido');
  assert.equal(G.decidirQuitar(-30, -799), 'volver');
  assert.equal(G.decidirQuitar(200, 2000), 'volver', 'a la derecha nunca quita');
  assert.equal(G.decidirQuitar(0, 0), 'volver');
});

await prueba('mientras se arrastra: el avance sube a 1 en el umbral, a la derecha es 0 y la derecha solo cede un cuarto', () => {
  assert.equal(G.avanceQuitar(-48), 0.5);
  assert.equal(G.avanceQuitar(-300), 1);
  assert.equal(G.avanceQuitar(40), 0);
  assert.equal(G.avanceQuitar(0), 0);
  assert.equal(G.amortiguarQuitar(-80), -80);
  assert.equal(G.amortiguarQuitar(80), 20);
  assert.equal(G.QUITAR.activa, 12);
  assert.equal(G.QUITAR.falla, 10);
});

/* ---------- Mi mazo: quitar y deshacer ---------- */

const mazo = (n) => Array.from({ length: n }, (_, i) => ({ id: 100 + i, frase: `frase ${i}` }));

await prueba('quitar de la lista: sale solo esa, dice dónde estaba y no modifica la lista de entrada', () => {
  const original = mazo(5);
  const copia = original.map((e) => e.id);
  const r = G.quitarDeLista(original, 102);
  assert.deepEqual(r.lista.map((e) => e.id), [100, 101, 103, 104]);
  assert.equal(r.indice, 2);
  assert.equal(r.elemento.id, 102);
  assert.deepEqual(original.map((e) => e.id), copia, 'la lista original queda igual');
  const noEsta = G.quitarDeLista(original, 999);
  assert.equal(noEsta.indice, -1);
  assert.equal(noEsta.elemento, null);
  assert.deepEqual(noEsta.lista.map((e) => e.id), copia);
});

await prueba('deshacer: quitar y reinsertar deja la lista como estaba, con 2 y con 30 frases y en cualquier lugar', () => {
  for (const n of [1, 2, 30]) {
    const original = mazo(n);
    for (let i = 0; i < n; i++) {
      const { lista, indice, elemento } = G.quitarDeLista(original, original[i].id);
      assert.equal(lista.length, n - 1);
      const vuelta = G.reinsertar(lista, elemento, indice);
      assert.deepEqual(vuelta.map((e) => e.id), original.map((e) => e.id), `n=${n}, i=${i}`);
    }
  }
});

await prueba('reinsertar no duplica, no se sale de la lista y quitar varias seguidas se puede deshacer en orden inverso', () => {
  const l = mazo(4);
  assert.equal(G.reinsertar(l, l[1], 1).length, 4, 'si ya está, no la duplica');
  assert.deepEqual(G.reinsertar(mazo(2), { id: 7 }, 99).map((e) => e.id), [100, 101, 7], 'un lugar de más va al final');
  assert.deepEqual(G.reinsertar(mazo(2), { id: 7 }, -3).map((e) => e.id), [7, 100, 101], 'uno de menos va al principio');
  const a = G.quitarDeLista(l, 101);
  const b = G.quitarDeLista(a.lista, 103);
  const sinB = G.reinsertar(b.lista, b.elemento, b.indice);
  const sinA = G.reinsertar(sinB, a.elemento, a.indice);
  assert.deepEqual(sinA.map((e) => e.id), [100, 101, 102, 103]);
  assert.deepEqual(G.quitarDeLista([], 1), { lista: [], indice: -1, elemento: null }, 'un mazo vacío no se rompe');
});

/* ---------- Mi mazo: lo que no se toca y lo que se puede revisar sin teléfono ---------- */

await prueba('lo que no se toca: `toggleFavorite`, el orden de `getFavorites` y SM-2 quedan como estaban', () => {
  const q = leer('src/db/queries.ts');
  assert.match(q, /DO UPDATE SET favorito = 1 - favorito;/, 'toggleFavorite sigue alternando');
  assert.match(q, /WHERE \$\{f\.sql\} AND t\.favorito = 1\s*ORDER BY t\.ultimo_repaso DESC NULLS LAST, e\.id ASC;/, 'el orden de siempre: aún no se guarda la fecha en que se guardó');
  assert.ok(!/guardada_en|fecha_guardado/.test(leer('src/db/schema.ts')), 'no se agregó ninguna columna');
  const mazoScreen = sinComentarios(leer('src/screens/utility/DeckScreen.tsx'));
  assert.ok(!/upsertCardState|useSessionStore|calificar|Repasar/.test(mazoScreen), 'Mi mazo no toca SM-2 ni ofrece «Repasar»');
});

await prueba('el aviso dura 5 s, «Deshacer» regresa la frase y un fallo de la base la regresa sola', () => {
  const motion = leer('src/theme/motion.ts');
  assert.match(motion, /export const motionAviso = \{ duracion: 5000 \} as const;/);
  assert.match(motion, /export const reacomodarResorte = \(\) =>\s*LinearTransition\.springify\(\)\s*\.damping\(motionSpring\.rebote\.damping\)/, 'las de abajo suben con el resorte de rebote');
  const pantalla = sinComentarios(leer('src/screens/utility/DeckScreen.tsx'));
  assert.match(pantalla, /setTimeout\(\(\) => setAviso\(null\), motionAviso\.duracion\)/);
  assert.match(pantalla, /texto=\{aviso\.tipo === 'quitada' \? 'Quitada de tu mazo'/);
  assert.match(pantalla, /onDeshacer=\{aviso\.tipo === 'quitada' \? deshacer : undefined\}/);
  assert.match(pantalla, /reinsertar\(l \?\? \[\], a\.entry, a\.indice\)/, 'deshacer la regresa a su lugar');
  assert.match(pantalla, /catch \{\s*setLista\(\(l\) => reinsertar\(l \?\? \[\], entry, r\.indice\)\);/, 'si la base falla, la frase vuelve');
  assert.match(pantalla, /itemLayoutAnimation=\{reducido \? undefined : REACOMODO\}/, 'sin resorte con reducir movimiento');
  assert.match(pantalla, /keyExtractor=\{claveEntrada\}/);
  assert.match(pantalla, /<Marcador\b/);
  assert.match(pantalla, /useFocusEffect\(/);
  assert.match(pantalla, /actionLabel="Ir a Frases sueltas"/);
  assert.match(pantalla, /body="Toca la estrella en cualquier frase para guardarla aquí\."/, 'el texto vacío ya dice cómo guardar');
  const aviso = sinComentarios(leer('src/components/mazo/AvisoDeshacer.tsx'));
  assert.match(aviso, /label="Deshacer"/);
  assert.match(aviso, /accessibilityLiveRegion="polite"/);
  assert.match(aviso, /\{onDeshacer && !reducido \? \(/, 'sin la barra con reducir movimiento');
  assert.ok(!/riskStrong|tone="strong"/.test(aviso));
});

await prueba('la tarjeta: acciones del lector, karaoke en h3, Inglés · Español, chevron, botón al mantener presionado y deslizar sin rojo', () => {
  const t = sinComentarios(leer('src/components/mazo/TarjetaGuardada.tsx'));
  assert.match(t, /export const TarjetaGuardada = memo\(/);
  for (const etiqueta of ['Quitar de mi mazo', 'Escuchar en inglés', 'Escuchar en español']) assert.ok(t.includes(`label: '${etiqueta}'`), etiqueta);
  assert.match(t, /onAccessibilityAction=\{alAccion\}/);
  assert.match(t, /<FraseKaraoke palabras=\{palabras\} voz=\{vozEn\} tamano="h3"/);
  assert.match(t, /etiqueta: 'Inglés'/);
  assert.match(t, /etiqueta: 'Español'/);
  assert.match(t, /name="chevron-right"/);
  assert.match(t, /onLongPress=\{alMantener\}/, 'mantener presionado muestra el botón');
  assert.match(t, /<Button variant="ghost" icon="star" label="Quitar de mi mazo"/);
  assert.match(t, /<DeslizarQuitar onQuitar=\{quitar\}>/);
  const d = sinComentarios(leer('src/components/mazo/DeslizarQuitar.tsx'));
  assert.match(d, /\.activeOffsetX\(\[-QUITAR\.activa, QUITAR\.activa\]\)/);
  assert.match(d, /\.failOffsetY\(\[-QUITAR\.falla, QUITAR\.falla\]\)/, 'cede ante el scroll de la lista');
  assert.match(d, /decidirQuitar\(tx\.value, e\.velocityX\)/);
  assert.match(d, /if \(reducido\) return <>\{children\}<\/>;/, 'con reducir movimiento no hay deslizamiento');
  assert.match(d, /name="star"/, 'la estrella en contorno');
  assert.match(d, /color\.wrongSoft/);
  assert.ok(!/riskStrong|tone="strong"/.test(d));
});

console.log(`\ncheck:atoradas ${total} pruebas ok\n`);
