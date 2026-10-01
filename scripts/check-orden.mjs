/**
 * Prueba que cada usuario recibe sus frases NUEVAS en un orden propio: al azar, distinto al de
 * cualquier otro y estable para él. Corre la consulta real (src/data/repos/cola.ts, consultaNuevas) sobre
 * SQLite (sql.js) con el catálogo real (assets/data/catalogo.json) y 5 usuarios con semillas al
 * azar, como las que da expo-crypto en el teléfono.
 *
 *   npm run check:orden
 *
 * Comprueba:
 *   a) las primeras 20 nuevas de cada usuario son distintas entre sí (coincidencias por azar bajas);
 *   b) para un mismo usuario, el orden es igual en llamadas repetidas;
 *   c) el filtro de vulgaridad (modo limpio) se respeta;
 *   d) con 'aleatorio_por_nivel', el nivel nunca baja a lo largo de la cola.
 * Y además que el orden de dos usuarios no es una rotación del mismo (por eso la semilla multiplica).
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const ts = require('typescript');
const initSqlJs = require('sql.js');

// ── carga de módulos puros (igual que check-srs) ─────────────────────────
const cache = new Map();
function resolver(spec, desde) {
  const base = spec.startsWith('@/') ? path.join(ROOT, 'src', spec.slice(2)) : path.resolve(path.dirname(desde), spec);
  for (const c of [`${base}.ts`, path.join(base, 'index.ts')]) if (fs.existsSync(c)) return c;
  throw new Error(`no se pudo resolver ${spec} desde ${path.relative(ROOT, desde)}`);
}
function cargar(archivo) {
  if (cache.has(archivo)) return cache.get(archivo);
  let js = ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  js = js.replace(/(from\s+|import\()\s*(["'])([^"']+)\2/g, (_, pre, q, spec) => {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) {
      throw new Error(`${path.relative(ROOT, archivo)} importa el paquete ${spec}: no es un módulo puro`);
    }
    return `${pre}"${cargar(resolver(spec, archivo))}"`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  cache.set(archivo, url);
  return url;
}
const importar = (rel) => import(cargar(path.join(ROOT, rel)));
const sql = await importar('src/data/repos/cola.ts');
const plan = await importar('src/domain/cola.ts');

// ── base con el catálogo real ────────────────────────────────────────────
const SQL = await initSqlJs();
const esquema = fs.readFileSync(path.join(ROOT, 'src/data/esquema.ts'), 'utf8');
const tarjeta = esquema.match(/CREATE TABLE IF NOT EXISTS tarjeta \([\s\S]*?\n    \);/)[0];
const catalogo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/catalogo.json'), 'utf8'));
const entradas = catalogo.entries ?? catalogo;

const db = new SQL.Database();
db.run('CREATE TABLE entrada (id INTEGER PRIMARY KEY, tipo TEXT, is_canonical INT, revisar INT, vulgaridad INT, nivel INT, pack_final TEXT, mundo TEXT)');
db.run(tarjeta);
const ins = db.prepare('INSERT INTO entrada VALUES (?,?,?,?,?,?,?,?)');
for (const e of entradas) {
  ins.run([e.id, e.tipo, e.is_canonical ? 1 : 0, e.revisar ? 1 : 0, e.vulgaridad ?? 0, e.nivel, e.pack_final ?? null, e.mundo ?? null]);
}
ins.free();

function correr(q) {
  const st = db.prepare(q.sql);
  st.bind(q.params);
  const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free();
  return out;
}

const TODAS = plan.filtroEstudio({ modoLimpio: false, niveles: [1, 2, 3] });
const LIMPIO = plan.filtroEstudio({ modoLimpio: true, niveles: [1, 2, 3] });
const nuevas = (usuario, semilla, limite, filtro = TODAS, orden = 'aleatorio') =>
  correr(sql.consultaNuevas(usuario, semilla, filtro, limite, orden));
const ids = (filas) => filas.map((f) => f.id);

// 5 usuarios con semillas de 32 bits al azar, como nuevaSemilla() en el teléfono.
const usuarios = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, semilla: crypto.randomBytes(4).readUInt32BE(0) }));
const disponibles = nuevas(1, 1, 100000).length;

let fallas = 0;
async function prueba(nombre, fn) {
  try {
    await fn();
    console.log(`  ok  ${nombre}`);
  } catch (err) {
    fallas++;
    console.log(`  MAL ${nombre}\n      ${err.message.split('\n').join('\n      ')}`);
  }
}

console.log(`catálogo: ${entradas.length} entradas, ${disponibles} frases nuevas posibles por usuario`);
console.log(`semillas: ${usuarios.map((u) => u.semilla).join(', ')}\n`);

const primeras = usuarios.map((u) => ids(nuevas(u.id, u.semilla, 20)));

await prueba('a) las primeras 20 nuevas de cada usuario son distintas entre sí', () => {
  // Con N frases, dos listas de 20 al azar comparten en promedio 20·20/N ≈ 0.3. Se acepta hasta 4.
  const esperado = (20 * 20) / disponibles;
  const pares = [];
  for (let a = 0; a < usuarios.length; a++) {
    for (let b = a + 1; b < usuarios.length; b++) {
      const comunes = primeras[a].filter((id) => primeras[b].includes(id)).length;
      pares.push({ a: a + 1, b: b + 1, comunes });
    }
  }
  const maximo = Math.max(...pares.map((p) => p.comunes));
  const total = pares.reduce((n, p) => n + p.comunes, 0);
  console.log(`      coincidencias por par (de 20): ${pares.map((p) => `${p.a}-${p.b}: ${p.comunes}`).join(', ')}`);
  console.log(`      promedio ${(total / pares.length).toFixed(2)} (el azar puro da ≈ ${esperado.toFixed(2)}), máximo ${maximo}`);
  assert.ok(maximo <= 4, `un par comparte ${maximo} de 20 frases`);
  for (const p of primeras) assert.equal(new Set(p).size, 20, 'una lista trae frases repetidas');
});

await prueba('antes del cambio (ORDER BY nivel, id) los 5 recibían exactamente las mismas 20', () => {
  const viejo = correr({
    sql: `SELECT e.id FROM entrada e LEFT JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
           WHERE e.is_canonical = 1 AND e.revisar = 0 AND e.tipo != 'regla_fonetica'
             AND (t.entry_id IS NULL OR t.ultimo_repaso IS NULL)
           ORDER BY e.nivel ASC, e.id ASC LIMIT 20;`,
    params: [1],
  }).map((f) => f.id);
  // Con el orden viejo no había nada por usuario: la lista es la misma para cualquiera.
  assert.ok(primeras.every((p) => p.join() !== viejo.join()), 'algún usuario sigue recibiendo la lista vieja');
  console.log(`      lista vieja (igual para todos): ${viejo.slice(0, 8).join(', ')}, …`);
  console.log(`      usuario 1 ahora:                ${primeras[0].slice(0, 8).join(', ')}, …`);
});

await prueba('el orden de dos usuarios no es el mismo recorrido desde otro punto (no es una rotación)', () => {
  // Si la semilla solo sumara, B sería A rotado y casi todos los pares consecutivos de A
  // aparecerían también consecutivos en B. Al azar, casi ninguno.
  const a = ids(nuevas(1, usuarios[0].semilla, disponibles));
  const posB = new Map(ids(nuevas(2, usuarios[1].semilla, disponibles)).map((id, i) => [id, i]));
  let seguidos = 0;
  for (let i = 0; i + 1 < a.length; i++) if (posB.get(a[i + 1]) === (posB.get(a[i]) ?? -9) + 1) seguidos++;
  console.log(`      pares consecutivos de A que siguen juntos en B: ${seguidos} de ${a.length - 1}`);
  assert.ok(seguidos < 10, `demasiados tramos compartidos (${seguidos})`);
});

await prueba('b) para un mismo usuario el orden es igual en llamadas repetidas', () => {
  for (const u of usuarios) {
    const primera = ids(nuevas(u.id, u.semilla, 200));
    for (let i = 0; i < 3; i++) assert.deepEqual(ids(nuevas(u.id, u.semilla, 200)), primera);
    // Y pedir menos da el principio de la misma lista: los conteos de Hoy y la sesión no se descuadran.
    assert.deepEqual(ids(nuevas(u.id, u.semilla, 20)), primera.slice(0, 20));
  }
});

await prueba('el orden es al azar, no el de los ids ni por nivel', () => {
  for (const u of usuarios) {
    const lista = nuevas(u.id, u.semilla, 200);
    const idsL = ids(lista);
    const ascendentes = idsL.filter((id, i) => i > 0 && id > idsL[i - 1]).length;
    // En un orden al azar, ~la mitad de los pasos suben; en el viejo, casi todos.
    assert.ok(ascendentes > 60 && ascendentes < 140, `usuario ${u.id}: ${ascendentes} de 199 pasos suben`);
    const niveles = new Set(lista.slice(0, 20).map((f) => f.nivel));
    assert.ok(niveles.size >= 2, `usuario ${u.id}: las primeras 20 son todas de un solo nivel`);
  }
});

await prueba('no sale en escalera (saltos iguales entre una frase y la siguiente)', () => {
  // Una mezcla solo lineal ordena los ids de m en m: los saltos entre vecinos se repiten.
  for (const u of usuarios) {
    const lista = ids(nuevas(u.id, u.semilla, 101));
    const saltos = lista.slice(1).map((id, i) => id - lista[i]);
    const distintos = new Set(saltos).size;
    assert.ok(distintos >= 90, `usuario ${u.id}: solo ${distintos} saltos distintos de 100`);
  }
});

await prueba('c) con modo limpio no sale ninguna frase con groserías', () => {
  for (const u of usuarios) {
    const lista = nuevas(u.id, u.semilla, 100000, LIMPIO);
    assert.ok(lista.length > 0);
    assert.ok(lista.every((f) => f.vulgaridad === 0), `usuario ${u.id}: salió una con vulgaridad`);
  }
  const conGroserias = entradas.filter((e) => (e.vulgaridad ?? 0) > 0 && e.is_canonical && !e.revisar && e.tipo !== 'regla_fonetica').length;
  console.log(`      frases con groserías en el catálogo: ${conGroserias}; con modo limpio salen 0`);
});

await prueba("d) con 'aleatorio_por_nivel' el nivel nunca baja a lo largo de la cola", () => {
  for (const u of usuarios) {
    const lista = nuevas(u.id, u.semilla, 100000, TODAS, 'aleatorio_por_nivel');
    assert.equal(lista.length, disponibles);
    for (let i = 1; i < lista.length; i++) {
      assert.ok(lista[i].nivel >= lista[i - 1].nivel, `usuario ${u.id}: baja de nivel en la posición ${i}`);
    }
    // Y dentro del nivel 1 sigue siendo al azar y propio del usuario.
    const n1 = ids(lista.filter((f) => f.nivel === 1));
    const ascendentes = n1.filter((id, i) => i > 0 && id > n1[i - 1]).length;
    assert.ok(ascendentes < n1.length * 0.7, `usuario ${u.id}: el nivel 1 va casi en orden de id`);
  }
  const d1 = ids(nuevas(1, usuarios[0].semilla, 20, TODAS, 'aleatorio_por_nivel'));
  const d2 = ids(nuevas(2, usuarios[1].semilla, 20, TODAS, 'aleatorio_por_nivel'));
  assert.ok(d1.filter((id) => d2.includes(id)).length <= 6, 'dos usuarios reciben el mismo nivel 1');
});

await prueba('la llave nunca se sale de los enteros de SQLite (64 bits)', () => {
  const maxId = Math.max(...entradas.map((e) => e.id));
  for (const semilla of [0, 1, 2 ** 31, 2 ** 32 - 1, ...usuarios.map((u) => u.semilla)]) {
    const { m, c } = sql.ordenDeSemilla(semilla);
    assert.ok(m >= 65537 && m < sql.PRIMO_ORDEN && c >= 0 && c < sql.PRIMO_ORDEN);
    assert.ok(maxId * m + c < 2 ** 53, `semilla ${semilla}: la llave no cabe`);
  }
});

console.log(fallas ? `\ncheck:orden: ${fallas} prueba(s) fallaron` : '\ncheck:orden ok');
process.exit(fallas ? 1 : 0);
