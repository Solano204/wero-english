/**
 * Prueba el mapa de niveles: estados, tramos, lista plana, medidas para el scroll y
 * estrellas nuevas.
 *
 *   npm run check:niveles
 *
 * niveles.ts no importa nada, así que se transpila en memoria con typescript y se
 * carga como módulo, sin jest. Las bandas salen de niveles.json, las reales.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const fuente = fs.readFileSync(path.join(ROOT, 'src/domain/niveles.ts'), 'utf8');
const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const N = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const { estadoNivel, armarTramos, aplanar, indicesEncabezado, medir, indiceDeNivel, offsetCentrado, estrellasNuevas, totalEstrellas, tituloTramo, avisoBloqueo, etiquetaNivel, COLUMNAS } = N;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

const niveles = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/niveles.json'), 'utf8'));
const bandasDe = (juego) => niveles.juegos[juego].bandas.map((b) => ({ id: b.id, nombre: b.nombre, desde: b.desde, hasta: b.hasta, frases: b.ids.length }));
const ctx = (siguiente, { estrellas = [], pagados = [], total: t = 200 } = {}) => ({
  total: t,
  siguiente,
  pagados: new Set(pagados),
  estrellas: new Map(estrellas),
});

prueba('estado de un nivel: perfecto, hecho, abierto, actual, anuncio y bloqueado', () => {
  const c = ctx(23, { estrellas: [[1, 3], [2, 1], [3, 2], [22, 3]], pagados: [] });
  assert.equal(estadoNivel(1, c), 'perfecto');
  assert.equal(estadoNivel(2, c), 'hecho', '1 estrella');
  assert.equal(estadoNivel(3, c), 'hecho', '2 estrellas');
  assert.equal(estadoNivel(4, c), 'abierto', 'abierto sin estrellas');
  assert.equal(estadoNivel(23, c), 'actual');
  assert.equal(estadoNivel(24, c), 'anuncio', 'el siguiente del actual se abre con anuncio');
  assert.equal(estadoNivel(25, c), 'bloqueado');
  assert.equal(estadoNivel(200, c), 'bloqueado');
});

prueba('un anuncio abre un solo nivel: el pagado queda abierto y el siguiente no encadena', () => {
  const c = ctx(23, { pagados: [24] });
  assert.equal(estadoNivel(24, c), 'abierto', 'el pagado ya está abierto (sin jugar)');
  assert.equal(estadoNivel(25, c), 'bloqueado', 'el que sigue del pagado no se ofrece: el anuncio es sobre siguiente + 1');
  assert.equal(estadoNivel(23, c), 'actual');
});

prueba('usuario nuevo: el nivel 1 es el actual y el 2 se abre con anuncio', () => {
  const c = ctx(1);
  assert.equal(estadoNivel(1, c), 'actual');
  assert.equal(estadoNivel(2, c), 'anuncio');
  assert.equal(estadoNivel(3, c), 'bloqueado');
});

prueba('con los 200 jugados no hay actual ni anuncio', () => {
  const todas = Array.from({ length: 200 }, (_, i) => [i + 1, 3]);
  const c = ctx(201, { estrellas: todas });
  for (let n = 1; n <= 200; n++) assert.equal(estadoNivel(n, c), 'perfecto', `nivel ${n}`);
});

prueba('tramos de Pares: usuario nuevo, tramo 1 abierto y los otros bloqueados', () => {
  const t = armarTramos(bandasDe('pares'), ctx(1));
  assert.deepEqual(t.map((x) => [x.id, x.desde, x.hasta, x.estado]), [['facil', 1, 70, 'abierto'], ['media', 71, 150, 'bloqueado'], ['dificil', 151, 200, 'bloqueado']]);
  assert.deepEqual(t.map((x) => x.maximo), [210, 240, 150], 'tres estrellas por nivel');
  assert.equal(avisoBloqueo(t[1]), 'Se abre al terminar el nivel 70');
  assert.equal(tituloTramo(t[1]), 'Niveles 71–150');
});

prueba('el tramo siguiente deja de estar bloqueado cuando su primer nivel se abre con anuncio', () => {
  // Jugados hasta el 69: siguiente = 70 (actual) y el 71 se abre con anuncio.
  const t = armarTramos(bandasDe('pares'), ctx(70));
  assert.equal(t[1].estado, 'abierto');
  assert.equal(t[1].niveles[0].estado, 'anuncio');
  assert.equal(t[2].estado, 'bloqueado');
  // Jugados hasta el 70: el 71 ya es el actual.
  assert.equal(armarTramos(bandasDe('pares'), ctx(71))[1].niveles[0].estado, 'actual');
});

prueba('un tramo con todas las estrellas es completo; con una menos, no', () => {
  const todas = Array.from({ length: 70 }, (_, i) => [i + 1, 3]);
  const t = armarTramos(bandasDe('pares'), ctx(71, { estrellas: todas }));
  assert.equal(t[0].estado, 'completo');
  assert.equal(t[0].estrellas, 210);
  const casi = todas.map(([n, e]) => [n, n === 40 ? 2 : e]);
  const t2 = armarTramos(bandasDe('pares'), ctx(71, { estrellas: casi }));
  assert.equal(t2[0].estado, 'abierto');
  assert.equal(t2[0].estrellas, 209);
});

prueba('lista plana: un encabezado por tramo y renglones de cinco; lo bloqueado y lo completo no traen renglones', () => {
  const nuevo = aplanar(armarTramos(bandasDe('pares'), ctx(1)), new Set());
  assert.equal(nuevo.filter((i) => i.tipo === 'tramo').length, 3);
  assert.equal(nuevo.filter((i) => i.tipo === 'fila').length, 14, '70 niveles en renglones de 5');
  assert.deepEqual(indicesEncabezado(nuevo), [0, 15, 16]);
  assert.ok(nuevo.filter((i) => i.tipo === 'fila').every((f) => f.niveles.length === COLUMNAS));
  const todas = Array.from({ length: 70 }, (_, i) => [i + 1, 3]);
  const tramos = armarTramos(bandasDe('pares'), ctx(71, { estrellas: todas }));
  assert.equal(aplanar(tramos, new Set()).filter((i) => i.tipo === 'fila').length, 16, 'el completo colapsa: solo los 16 de la media (80 niveles)');
  const abierto = aplanar(tramos, new Set(['facil']));
  assert.equal(abierto.filter((i) => i.tipo === 'fila').length, 30, 'expandido vuelve con sus 14');
  assert.equal(new Set(abierto.map((i) => i.key)).size, abierto.length, 'las llaves no se repiten');
  const filas = abierto.filter((i) => i.tipo === 'fila').map((f) => f.fila);
  assert.deepEqual(filas, filas.map((_, i) => i), 'el número de renglón corre sin huecos');
});

prueba('medidas: cada ítem empieza donde acaba el anterior', () => {
  const items = aplanar(armarTramos(bandasDe('pares'), ctx(1)), new Set());
  const m = medir(items, 72, 67);
  assert.equal(m.offsets[0], 0);
  assert.equal(m.offsets[1], 72);
  assert.equal(m.offsets[2], 72 + 67);
  assert.equal(m.largo, 3 * 72 + 14 * 67);
  for (let i = 1; i < items.length; i++) assert.equal(m.offsets[i], m.offsets[i - 1] + m.alturas[i - 1]);
});

prueba('scroll centrado: el nivel actual queda en medio de lo que se ve y no se pasa de los extremos', () => {
  const items = aplanar(armarTramos(bandasDe('pares'), ctx(23)), new Set());
  const m = medir(items, 72, 67);
  const i = indiceDeNivel(items, 23);
  assert.ok(i > 0);
  assert.equal(items[i].niveles.some((v) => v.n === 23), true);
  const viewport = 600;
  const off = offsetCentrado(m, i, viewport, 72);
  // Lo que se ve va de `off + 72` (bajo el encabezado pegado) a `off + viewport`.
  const centroVisible = off + (72 + viewport) / 2;
  const centroFila = m.offsets[i] + 67 / 2;
  assert.ok(Math.abs(centroVisible - centroFila) < 1e-9, 'el renglón queda centrado');
  assert.equal(offsetCentrado(m, 1, viewport, 72), 0, 'al inicio no baja de 0');
  assert.equal(offsetCentrado(m, items.length - 1, viewport, 72), m.largo - viewport, 'al final no pasa del largo');
  assert.equal(offsetCentrado(m, 999, viewport, 72), 0, 'un índice que no existe no rompe');
  assert.equal(indiceDeNivel(items, 150), -1, 'un nivel de un tramo bloqueado no tiene renglón');
});

prueba('estrellas nuevas: solo lo que subió, y sin foto previa nada', () => {
  const antes = new Map([[1, 3], [2, 1], [3, 0]]);
  const ahora = new Map([[1, 3], [2, 3], [3, 1], [4, 2]]);
  assert.deepEqual(estrellasNuevas(antes, ahora), [
    { nivel: 2, antes: 1, ahora: 3 },
    { nivel: 3, antes: 0, ahora: 1 },
    { nivel: 4, antes: 0, ahora: 2 },
  ]);
  assert.deepEqual(estrellasNuevas(null, ahora), [], 'primera vez: nada que celebrar');
  assert.deepEqual(estrellasNuevas(ahora, new Map([[2, 1]])), [], 'nunca devuelve una baja');
  assert.equal(totalEstrellas(ahora), 9);
});

prueba('lo que anuncia el lector de pantalla', () => {
  assert.equal(etiquetaNivel(16, 'hecho', 1), 'Nivel 16, 1 de 3 estrellas');
  assert.equal(etiquetaNivel(24, 'anuncio', 0), 'Nivel 24, se abre con un anuncio');
  assert.equal(etiquetaNivel(30, 'bloqueado', 0), 'Nivel 30, bloqueado');
  assert.equal(etiquetaNivel(23, 'actual', 0), 'Nivel 23, el que sigue');
  assert.equal(etiquetaNivel(5, 'perfecto', 3), 'Nivel 5, 3 de 3 estrellas');
  assert.equal(etiquetaNivel(9, 'abierto', 0), 'Nivel 9, 0 de 3 estrellas');
});

prueba('los cuatro juegos: las bandas cubren 1 a 200 sin huecos y los estados cuadran en cualquier punto', () => {
  for (const juego of Object.keys(niveles.juegos)) {
    const bandas = bandasDe(juego);
    assert.equal(bandas[0].desde, 1, juego);
    assert.equal(bandas.at(-1).hasta, niveles.juegos[juego].total, juego);
    for (let i = 1; i < bandas.length; i++) assert.equal(bandas[i].desde, bandas[i - 1].hasta + 1, `${juego}: sin huecos`);
    for (const siguiente of [1, 2, 23, 69, 70, 71, 150, 151, 199, 200, 201]) {
      const tramos = armarTramos(bandas, ctx(siguiente, { estrellas: [[1, 3], [2, 2]] }));
      const todos = tramos.flatMap((t) => t.niveles);
      assert.equal(todos.length, 200, `${juego} @${siguiente}`);
      assert.ok(todos.filter((v) => v.estado === 'actual').length <= 1, 'un solo actual');
      assert.ok(todos.filter((v) => v.estado === 'anuncio').length <= 1, 'un solo nivel con anuncio');
      const items = aplanar(tramos, new Set());
      const m = medir(items, 72, 67);
      assert.equal(m.offsets.length, items.length);
    }
  }
});

console.log(`\ncheck:niveles ${total} pruebas ok`);
