/**
 * Prueba lo puro de Errores que te delatan sobre los 194 errores reales:
 *
 *   npm run check:errores
 *
 *  - los filtros con su cuenta y el orden (que solo reordena, nunca filtra);
 *  - el encabezado («194 errores» / «32 de 194»), las etiquetas de gravedad y lo que se anuncia y se comparte;
 *  - lo que se puede revisar sin teléfono de la lista y del detalle (sin rojo, sin badges de gravedad sueltos).
 *
 * errores.ts solo importa tipos: se transpila en memoria con typescript, sin jest.
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

const E = await cargar('src/domain/errores.ts');
const datos = JSON.parse(leer('assets/data/errores.json'));
const errores = datos.errores;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

/* ---------- filtros, cuenta y orden ---------- */

prueba('los 194 errores: cada chip lleva su cuenta y todas suman el total', () => {
  assert.equal(errores.length, 194);
  assert.equal(datos.total, 194);
  const cuenta = E.conteoPorCategoria(errores);
  assert.equal(cuenta.todos, 194);
  const categorias = E.CATEGORIAS_ERRORES.filter((c) => c.id !== 'todos');
  assert.equal(categorias.reduce((s, c) => s + cuenta[c.id], 0), 194, 'las cuentas de las categorías suman el total');
  for (const c of categorias) {
    assert.equal(cuenta[c.id], errores.filter((e) => e.categoria === c.id).length, c.label);
    assert.ok(cuenta[c.id] > 0, `${c.label} tiene errores`);
  }
  assert.ok(errores.every((e) => E.CATEGORIAS_ERRORES.some((c) => c.id === e.categoria)), 'ninguna categoría queda sin chip');
  assert.deepEqual(E.CATEGORIAS_ERRORES.map((c) => c.label), ['Todos', 'Falsos amigos', 'Calcos', 'Gramática', 'Preposiciones', 'Pronunciación', 'Tono', 'Escritura']);
});

prueba('filtrar: cada chip deja solo su categoría; «Todos» deja los 194; el orden no cambia lo que queda', () => {
  for (const c of E.CATEGORIAS_ERRORES) {
    const g = E.filtrarYOrdenar(errores, c.id, 'graves');
    const o = E.filtrarYOrdenar(errores, c.id, 'orden');
    assert.ok(g.every((e) => c.id === 'todos' || e.categoria === c.id), `${c.label}: solo lo suyo`);
    assert.deepEqual(new Set(g.map((e) => e.id)), new Set(o.map((e) => e.id)), `${c.label}: los dos órdenes muestran lo mismo`);
    assert.equal(g.length, E.conteoPorCategoria(errores)[c.id], `${c.label}: la cuenta del chip es lo que se ve`);
  }
});

prueba('«Más graves primero»: la gravedad baja de 3 a 1 y, a igual gravedad, se respeta el orden del contenido', () => {
  const l = E.filtrarYOrdenar(errores, 'todos', 'graves');
  for (let i = 1; i < l.length; i++) {
    assert.ok(l[i - 1].gravedad >= l[i].gravedad, `#${i}: la gravedad no sube`);
    if (l[i - 1].gravedad === l[i].gravedad) assert.ok(l[i - 1].orden < l[i].orden, `#${i}: a igual gravedad, por orden`);
  }
  assert.equal(l[0].gravedad, 3);
  assert.equal(l.filter((e) => e.gravedad === 3).length, 16);
});

prueba('«En orden»: sale por el campo `orden`, sin importar la gravedad', () => {
  const l = E.filtrarYOrdenar(errores, 'todos', 'orden');
  for (let i = 1; i < l.length; i++) assert.ok(l[i - 1].orden < l[i].orden, `#${i}`);
});

prueba('ordenar no modifica la lista de entrada y el ajuste guardado se normaliza', () => {
  const copia = errores.map((e) => e.id);
  E.filtrarYOrdenar(errores, 'todos', 'graves');
  E.filtrarYOrdenar(errores, 'calco', 'orden');
  assert.deepEqual(errores.map((e) => e.id), copia);
  assert.equal(E.normalizarOrden('orden'), 'orden');
  assert.equal(E.normalizarOrden('graves'), 'graves');
  for (const raro of [undefined, null, 3, 'otro', '']) assert.equal(E.normalizarOrden(raro), 'graves', String(raro));
  assert.deepEqual(E.ORDENES_ERRORES.map((o) => o.label), ['Más graves primero', 'En orden']);
  assert.match(leer('src/db/settings.ts'), /ordenErrores: 'graves',/, 'el orden de siempre es el que arranca');
});

/* ---------- encabezado, gravedad, anuncio y compartir ---------- */

prueba('el encabezado: «194 errores» sin filtro y «32 de 194» con filtro', () => {
  assert.deepEqual(E.encabezadoErrores('todos', 194, 194), { numero: 194, resto: 'errores', anuncio: '194 errores' });
  assert.deepEqual(E.encabezadoErrores('calco', 40, 194), { numero: 40, resto: 'de 194', anuncio: '40 de 194 errores' });
  assert.deepEqual(E.encabezadoErrores('registro', 32, 194), { numero: 32, resto: 'de 194', anuncio: '32 de 194 errores' });
});

prueba('la gravedad se dice con texto: Suena raro, Te delata, Cambia el significado', () => {
  assert.equal(E.etiquetaGravedad(1), 'Suena raro');
  assert.equal(E.etiquetaGravedad(2), 'Te delata');
  assert.equal(E.etiquetaGravedad(3), 'Cambia el significado');
  assert.equal(E.anuncioGravedad(2), 'Gravedad: Te delata, 2 de 3');
  for (const e of errores) assert.ok([1, 2, 3].includes(e.gravedad), `${e.id}: gravedad ${e.gravedad}`);
});

prueba('el detalle se anuncia en orden y sin doble punto; el texto de compartir trae los tres y la app', () => {
  const e = errores.find((x) => x.id === 'err_001');
  assert.equal(
    E.anuncioDeError(e),
    'Lo que dices: I am constipated. Lo que entienden: Estoy estreñido. Lo correcto: I have a cold.'
  );
  assert.equal(
    E.textoParaCompartir(e),
    'Decía «I am constipated» y lo que entienden es «Estoy estreñido». Se dice «I have a cold».\nLo aprendí con Wero.'
  );
  for (const x of errores) {
    const anuncio = E.anuncioDeError(x);
    assert.ok(!/[?!…]\./.test(anuncio) && !/\.\./.test(anuncio), `${x.id}: doble signo en «${anuncio}»`);
    const compartir = E.textoParaCompartir(x);
    for (const t of [x.lo_que_dices, x.lo_que_entienden, x.lo_correcto]) assert.ok(compartir.includes(t.trim()), `${x.id}: falta «${t}»`);
    assert.ok(compartir.endsWith('Lo aprendí con Wero.'));
  }
});

/* ---------- lo que se puede revisar sin teléfono ---------- */

prueba('la lista y el detalle no usan rojo ni el badge de gravedad: la gravedad es un medidor con texto, en ámbar', () => {
  for (const rel of ['src/screens/extras/ErrorsScreen.tsx', 'src/screens/extras/ErrorDetailScreen.tsx']) {
    const codigo = sinComentarios(leer(rel));
    assert.ok(!/riskStrong|tone="strong"/.test(codigo), `${rel}: sin rojo`);
    assert.ok(!/label="Cambia el significado"/.test(codigo), `${rel}: la gravedad no es un badge suelto`);
  }
  const detalle = sinComentarios(leer('src/screens/extras/ErrorDetailScreen.tsx'));
  assert.doesNotMatch(detalle, /errImg: \{[^}]*alignSelf/, 'la imagen no se centra encogida: `ancha` la estira');
});

prueba('la lista: encabezado con marcador, chips con cuenta y orden guardado en ajustes', () => {
  const p = sinComentarios(leer('src/screens/extras/ErrorsScreen.tsx'));
  assert.match(p, /<Marcador\b/, 'el número rueda con el Marcador');
  assert.match(p, /encabezadoErrores\(/);
  assert.match(p, /conteoPorCategoria\(/);
  assert.match(p, /filtrarYOrdenar\(/);
  assert.match(p, /useSettingsStore\(\(s\) => s\.ordenErrores\)/);
  assert.match(p, /'ordenErrores'/, 'el orden se guarda');
  assert.match(p, /<TarjetaError\b/);
  assert.match(p, /keyExtractor=\{claveError\}/);
  assert.match(p, /removeClippedSubviews/);
  assert.ok(existe('src/components/errores/TarjetaError.tsx') && existe('src/components/errores/MedidorGravedad.tsx'));
  const tarjeta = sinComentarios(leer('src/components/errores/TarjetaError.tsx'));
  assert.match(tarjeta, /<MedidorGravedad\b/);
  assert.match(tarjeta, /color\.wrong/, 'la ✕ y lo dicho van en ámbar');
  assert.match(tarjeta, /color\.correct/, 'la ✓ va en verde');
  assert.match(tarjeta, /Para contar/);
  assert.match(tarjeta, /export const TarjetaError = memo\(/);
  const medidor = sinComentarios(leer('src/components/errores/MedidorGravedad.tsx'));
  assert.match(medidor, /anuncioGravedad\(/);
  assert.match(medidor, /etiquetaGravedad\(/);
});

console.log(`\ncheck:errores ${total} pruebas ok\n`);
