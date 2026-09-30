/**
 * Prueba la cola de repaso: la lógica pura (SM-2, motor de sesión, cupos) y
 * las consultas SQL reales de src/db/cola.ts contra SQLite en memoria (sql.js).
 *
 *   npm run check:srs              corre las pruebas
 *   npm run check:srs -- --informe imprime además una cola de ejemplo
 *
 * Los módulos puros de src/ se transpilan en memoria y se cargan como módulos
 * de Node (sin jest); si alguno importa un paquete, la prueba avisa.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const ts = require('typescript');
const initSqlJs = require('sql.js');

// ── carga de módulos puros ───────────────────────────────────────────────
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

const fecha = await importar('src/utils/date.ts');
const sm2 = await importar('src/domain/sm2.ts');
const { StudySession, etiquetaRepaso, sesionMerece, etiquetaProximoRepaso } = await importar('src/domain/session.ts');
const plan = await importar('src/domain/cola.ts');
const sql = await importar('src/db/cola.ts');
const plantillas = await importar('src/domain/plantillas.ts');
const INFORME = process.argv.includes('--informe');

// ── datos y base de prueba ───────────────────────────────────────────────
const MX = 'America/Mexico_City';
const MIN = 60_000;
const DIA = 86_400_000;
process.env.TZ = MX;
const AHORA = new Date(2026, 8, 19, 9, 0, 0).getTime(); // 19 sep 2026, 9:00 hora local

const SQL = await initSqlJs();
const esquema = fs.readFileSync(path.join(ROOT, 'src/db/schema.ts'), 'utf8');
const tabla = (nombre) => {
  const m = esquema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${nombre} \\([\\s\\S]*?\\n    \\);`));
  if (!m) throw new Error(`no encontré la tabla ${nombre} en schema.ts`);
  return m[0];
};

function base({ entradas = 100, filas = [], sesiones = [], nivelDe = () => 1 } = {}) {
  const db = new SQL.Database();
  db.run('CREATE TABLE entrada (id INTEGER PRIMARY KEY, tipo TEXT, is_canonical INT, revisar INT, vulgaridad INT, nivel INT, pack_final TEXT, mundo TEXT)');
  db.run(tabla('tarjeta'));
  db.run(tabla('sesion'));
  for (let i = 1; i <= entradas; i++) db.run("INSERT INTO entrada VALUES (?, 'frase', 1, 0, 0, ?, NULL, NULL)", [i, nivelDe(i)]);
  for (const f of filas) guardarFila(db, f);
  for (const s of sesiones) db.run('INSERT INTO sesion (usuario_id, dia, inicio, nuevas) VALUES (1, ?, ?, ?)', [s.dia, s.inicio ?? 0, s.nuevas]);
  return db;
}
function guardarFila(db, f) {
  const e = { repeticiones: 0, intervalo: 0, facilidad: 2.5, vence_en: 0, ultimo_repaso: null, fallos: 0, aciertos: 0, dominada: 0, favorito: 0, ...f };
  db.run(sql.SQL_UPSERT_TARJETA, sql.paramsUpsertTarjeta(1, e));
  if (e.favorito) db.run('UPDATE tarjeta SET favorito = 1 WHERE usuario_id = 1 AND entry_id = ?', [e.entry_id]);
}
function consulta(db, texto, params) {
  const st = db.prepare(texto);
  st.bind(params);
  const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free();
  return out;
}

// Las consultas salen de db/cola.ts con su SQL y sus parámetros, igual que en
// db/queries.ts: aquí no se arma ningún parámetro a mano.
const FILTRO = plan.filtroEstudio({ modoLimpio: false, niveles: [1, 2, 3] });
const correr = (db, q) => consulta(db, q.sql, q.params);
const contar = (db, now, filtro = FILTRO) => correr(db, sql.consultaContarVencidas(1, filtro, now))[0].n;
const vencidas = (db, now, limite, filtro = FILTRO) => correr(db, sql.consultaVencidas(1, filtro, limite, now));
// Semilla fija del usuario de prueba: su orden de nuevas es al azar, pero siempre el mismo.
const SEMILLA = 123456789;
const nuevas = (db, limite, filtro = FILTRO) => correr(db, sql.consultaNuevas(1, SEMILLA, filtro, limite));
const nuevasHoy = (db, now) => correr(db, sql.consultaNuevasHoy(1, now))[0].n;
const diagnostico = (db, now, filtro = FILTRO) => correr(db, sql.consultaDiagnosticoCola(1, filtro, now))[0];
const estadoDe = (r) => ({ entry_id: r.id ?? r.entry_id, repeticiones: r.repeticiones ?? 0, intervalo: r.intervalo ?? 0, facilidad: r.facilidad ?? 2.5, vence_en: r.vence_en ?? 0, ultimo_repaso: r.ultimo_repaso ?? null, fallos: r.fallos ?? 0, aciertos: r.aciertos ?? 0, dominada: r.dominada ?? 0, favorito: r.favorito ?? 0 });
const entrada = (id) => ({ id, phrase: `phrase ${id}`, phrase_tts: `this is phrase ${id}`, spanish_main: `frase ${id}`, audio_en: null, word_count: 4, completar_palabra: null, completar_distractores: [], no_usar_cuando: null });
const pares = (rows) => rows.map((r) => ({ entry: entrada(r.id), state: estadoDe(r) }));
const armar = (db, { size = 20, porDia = 10, yaHoy = 0, now = AHORA } = {}) =>
  plan.armarSesion({
    size,
    nuevasPorDia: porDia,
    yaHoy,
    traerNuevas: async (n) => nuevas(db, n),
    traerVencidas: async (n) => vencidas(db, now, n),
  });
/** Una tarjeta ya graduada, vencida hace `hace` días. */
const graduada = (id, hace) => ({ entry_id: id, repeticiones: 4, intervalo: 3, vence_en: AHORA - hace * DIA, ultimo_repaso: AHORA - (hace + 3) * DIA, aciertos: 4 });

// ── arnés ────────────────────────────────────────────────────────────────
let total = 0;
async function prueba(nombre, fn) {
  process.env.TZ = MX;
  await fn();
  total++;
  console.log(`  ok  ${nombre}`);
}
const ids = (rows) => rows.map((r) => r.id ?? r.entry?.id);

console.log('cola de repaso');

// ── definición de vencida ────────────────────────────────────────────────
await prueba('una favorita nunca estudiada no es vencida: es nueva', () => {
  const db = base({ entradas: 5, filas: [{ entry_id: 1, favorito: 1 }] });
  assert.equal(contar(db, AHORA), 0);
  // Las cinco, en el orden propio del usuario (ya no por id): se comparan como conjunto.
  assert.deepEqual(ids(nuevas(db, 10)).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

await prueba('en aprendizaje y respondida hoy no vuelve hoy, vuelve mañana', () => {
  const db = base({ entradas: 3, filas: [{ entry_id: 1, repeticiones: 1, vence_en: AHORA - MIN, ultimo_repaso: AHORA - 5 * MIN }] });
  assert.equal(contar(db, AHORA), 0);
  assert.equal(contar(db, AHORA + DIA), 1);
});

await prueba('en aprendizaje y respondida ayer sí es vencida', () => {
  const db = base({ entradas: 3, filas: [{ entry_id: 1, repeticiones: 1, vence_en: AHORA - DIA + MIN, ultimo_repaso: AHORA - DIA }] });
  assert.equal(contar(db, AHORA), 1);
});

await prueba('en aprendizaje respondida a las 11:55 pm de ayer sí toca hoy, aunque venza a las 00:05', () => {
  const ayer2355 = new Date(2026, 8, 18, 23, 55, 0).getTime();
  const db = base({ entradas: 3, filas: [{ entry_id: 1, repeticiones: 1, vence_en: ayer2355 + 10 * MIN, ultimo_repaso: ayer2355 }] });
  assert.equal(contar(db, AHORA), 1);
  assert.deepEqual(ids(vencidas(db, AHORA, 5)), [1]);
});

await prueba('las más atrasadas van primero', () => {
  const db = base({ entradas: 5, filas: [graduada(1, 1), graduada(2, 10), graduada(3, 3)] });
  assert.deepEqual(ids(vencidas(db, AHORA, 10)), [2, 3, 1]);
  assert.equal(contar(db, AHORA), 3);
});

await prueba('lo que vence mañana no cuenta hoy', () => {
  const db = base({ entradas: 3, filas: [{ ...graduada(1, 0), vence_en: fecha.startOfDay(AHORA + DIA) }] });
  assert.equal(contar(db, AHORA), 0);
});

await prueba('diagnóstico: vencidas / de aprendizaje / fantasma', () => {
  const db = base({
    entradas: 10,
    filas: [
      graduada(1, 2), graduada(2, 5),
      { entry_id: 3, repeticiones: 1, vence_en: AHORA - DIA + MIN, ultimo_repaso: AHORA - DIA },
      { entry_id: 4, repeticiones: 1, vence_en: AHORA - MIN, ultimo_repaso: AHORA - 5 * MIN },
      { entry_id: 5, favorito: 1 }, { entry_id: 6, favorito: 1 },
    ],
  });
  assert.deepEqual({ ...diagnostico(db, AHORA) }, { vencidas: 3, aprendizaje: 1, fantasma: 2 });
});

await prueba('un filtro que agrega parámetros no desordena los de la cola', () => {
  const nivelDe = (i) => 1 + (i % 3);
  const filas = [1, 2, 3, 4, 5, 6].map((id) => graduada(id, id));
  const db = base({ entradas: 9, filas, nivelDe });
  const soloNivel1 = { modoLimpio: false, niveles: [1] };
  const esperado = filas.filter((f) => nivelDe(f.entry_id) === 1).map((f) => f.entry_id).sort((a, b) => b - a); // más atrasadas primero
  assert.deepEqual(ids(vencidas(db, AHORA, 10, soloNivel1)), esperado);
  assert.equal(contar(db, AHORA, soloNivel1), esperado.length);
  assert.equal(diagnostico(db, AHORA, soloNivel1).vencidas, esperado.length);
  assert.ok(nuevas(db, 10, soloNivel1).every((r) => nivelDe(r.id) === 1));
});

// ── sesión: orden, nuevas y topes ────────────────────────────────────────
await prueba('la sesión sirve vencidas antes que nuevas, las más atrasadas primero', async () => {
  const db = base({ entradas: 20, filas: [graduada(2, 4), graduada(3, 9), graduada(4, 1)] });
  const { due, fresh } = await armar(db);
  const s = new StudySession({ due: pares(due), fresh: pares(fresh), meta: 20, distractorsFor: () => [] });
  const vistas = [];
  while (!s.terminada) {
    vistas.push(s.current().entry.id);
    s.answer({ grade: 3, correct: true, elapsedMs: 5000, usedHint: false });
  }
  assert.deepEqual(vistas.slice(0, 3), [3, 2, 4]);
  assert.ok(vistas.slice(3).every((id) => ![2, 3, 4].includes(id)), 'después de las vencidas solo hay nuevas');
});

await prueba('el límite diario de nuevas se respeta', async () => {
  const db = base({
    entradas: 50,
    sesiones: [{ dia: fecha.dayKey(AHORA), nuevas: 4 }, { dia: fecha.dayKey(AHORA), nuevas: 3 }, { dia: fecha.dayKey(AHORA - DIA), nuevas: 9 }],
  });
  const ya = nuevasHoy(db, AHORA);
  assert.equal(ya, 7, 'suma las sesiones de hoy y no las de ayer');
  assert.equal((await armar(db, { yaHoy: ya })).fresh.length, 3);
  assert.equal((await armar(db, { yaHoy: 10 })).fresh.length, 0);
  assert.equal((await armar(db, { yaHoy: 0 })).fresh.length, 10);
});

const colaGrande = () => base({ entradas: 1200, filas: Array.from({ length: 850 }, (_, i) => graduada(i + 1, 1 + Math.floor(i / 5))) });

await prueba('con 850 vencidas la sesión es de 20: 17 vencidas y 3 nuevas reservadas', async () => {
  const db = colaGrande();
  const { due, fresh } = await armar(db);
  assert.equal(due.length, 17);
  assert.equal(fresh.length, 3);
  assert.equal(due.length + fresh.length, 20);
  const esperadas = ids(vencidas(db, AHORA, 17));
  assert.deepEqual(ids(due), esperadas, 'son las 17 más atrasadas');
});

await prueba('el tamaño de la sesión sigue a metaDiaria y las nuevas reservadas dependen del cupo', async () => {
  const db = colaGrande();
  const a = await armar(db, { size: 40 });
  assert.equal(a.due.length + a.fresh.length, 40);
  assert.equal(a.fresh.length, 3);
  const b = await armar(db, { yaHoy: 10 });
  assert.deepEqual([b.due.length, b.fresh.length], [20, 0], 'sin cupo de nuevas, todo son vencidas');
  const c = await armar(db, { porDia: 2 });
  assert.deepEqual([c.due.length, c.fresh.length], [18, 2], 'con cupo de 2, se reservan 2');
});

await prueba('con pocas vencidas el resto se llena con nuevas, sin pasar del límite diario', async () => {
  const db = base({ entradas: 60, filas: [graduada(1, 2), graduada(2, 3), graduada(3, 4), graduada(4, 5), graduada(5, 6)] });
  const { due, fresh } = await armar(db);
  assert.deepEqual([due.length, fresh.length], [5, 10]);
});

await prueba('sin vencidas ni nuevas la sesión sale vacía', async () => {
  const futuras = Array.from({ length: 5 }, (_, i) => ({ ...graduada(i + 1, 0), vence_en: fecha.startOfDay(AHORA + 2 * DIA) }));
  const db = base({ entradas: 5, filas: futuras });
  const { due, fresh } = await armar(db);
  assert.equal(due.length + fresh.length, 0);
  const sinCupo = await armar(base({ entradas: 30 }), { porDia: 0 });
  assert.equal(sinCupo.due.length + sinCupo.fresh.length, 0);
});

await prueba('las nuevas solo cuentan al responderse', () => {
  const s = new StudySession({ due: [], fresh: pares([1, 2, 3].map((id) => ({ id }))), meta: 20, distractorsFor: () => [] });
  s.answer({ grade: 3, correct: true, elapsedMs: 5000, usedHint: false });
  assert.equal(s.summary(0).newCards, 1);
});

// ── cada sesión, otras frases y otro orden ─────────────────────────────────
const nuevasDeSesion = (db, limite, sal, usuario = SEMILLA) => correr(db, sql.consultaNuevas(1, sql.semillaDeSesion(usuario, sal), FILTRO, limite));
/** Un azar fijo (LCG) para que las pruebas del orden al azar se repitan igual. */
const azarFijo = (semilla) => () => ((semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296);
/** Guarda en la base lo que el motor devolvió al contestar (como upsertCardState). */
const persistir = (db, estado) => db.run(sql.SQL_UPSERT_TARJETA, sql.paramsUpsertTarjeta(1, estado));

await prueba('entrar 3 veces seguidas sin contestar: cada sesión sortea otras nuevas y en otro orden', () => {
  const db = base({ entradas: 300 });
  const listas = [0x1234, 0xbeef, 0x51ab].map((sal) => ids(nuevasDeSesion(db, 10, sal)));
  for (let i = 0; i < listas.length; i++) {
    for (let j = i + 1; j < listas.length; j++) {
      const comunes = listas[i].filter((id) => listas[j].includes(id)).length;
      assert.ok(comunes <= 2, `las sesiones ${i + 1} y ${j + 1} comparten ${comunes} de 10 (al azar se esperan ~0.3)`);
    }
  }
  // La misma sal da la misma lista (el conteo y la sesión no se descuadran dentro de una sesión).
  assert.deepEqual(ids(nuevasDeSesion(db, 10, 0x1234)), listas[0]);
});

await prueba('dos usuarios nuevos: frases distintas entre ellos aunque la sal coincida', () => {
  const db = base({ entradas: 300 });
  const a = ids(nuevasDeSesion(db, 10, 7, 111));
  const b = ids(nuevasDeSesion(db, 10, 7, 222));
  assert.ok(a.filter((id) => b.includes(id)).length <= 2);
});

await prueba('las nuevas mostradas y no contestadas se evitan en la siguiente sesión, mientras haya otras', async () => {
  const db = base({ entradas: 40 });
  const primera = await plan.armarSesion({ size: 20, nuevasPorDia: 10, yaHoy: 0, traerNuevas: async (n) => nuevasDeSesion(db, n, 1), traerVencidas: async () => [] });
  const s = new StudySession({ due: [], fresh: pares(primera.fresh), meta: 20, distractorsFor: () => [] });
  const vista = s.current().entry.id;
  s.skip();
  const segunda = s.current().entry.id;
  s.answer({ grade: 3, correct: true, elapsedMs: 5000, usedHint: false });
  s.current();
  const sinContestar = s.nuevasSinContestar();
  assert.ok(sinContestar.includes(vista), 'la saltada cuenta como mostrada sin contestar');
  assert.ok(!sinContestar.includes(segunda), 'la contestada no');
  const excluir = new Set(sinContestar);
  // Sal que la pondría primero: aun así no entra, porque hay otras.
  const traerPrimero = async (n) => {
    const todas = nuevasDeSesion(db, 40, 1);
    return [...todas.filter((r) => excluir.has(r.id)), ...todas.filter((r) => !excluir.has(r.id))].slice(0, n);
  };
  const otra = await plan.armarSesion({ size: 20, nuevasPorDia: 10, yaHoy: 0, traerNuevas: traerPrimero, traerVencidas: async () => [], excluir, idDe: (r) => r.id });
  assert.ok(ids(otra.fresh).every((id) => !excluir.has(id)), 'ninguna de las no contestadas vuelve');
  assert.equal(otra.fresh.length, 10);
  // Sin otras disponibles, sí vuelven.
  const unaSola = await plan.armarSesion({ size: 20, nuevasPorDia: 10, yaHoy: 0, traerNuevas: async () => [{ id: vista }], traerVencidas: async () => [], excluir, idDe: (r) => r.id });
  assert.deepEqual(ids(unaSola.fresh), [vista]);
});

await prueba('contestar 5, salir y volver: las 5 no vuelven hoy (salvo las falladas) y el resto se re-sortea', async () => {
  const db = base({ entradas: 200 });
  const armarCon = (sal, yaHoy, excluir) =>
    plan.armarSesion({
      size: 20, nuevasPorDia: 20, yaHoy,
      traerNuevas: async (n) => nuevasDeSesion(db, n, sal),
      traerVencidas: async (n) => vencidas(db, AHORA, n),
      excluir, idDe: (r) => r.id,
    });
  const uno = await armarCon(11, 0, new Set());
  const s = new StudySession({ due: pares(uno.due), fresh: pares(uno.fresh), meta: 20, distractorsFor: () => [], maxReinserciones: 1, intercalar: true, azar: azarFijo(3) }, AHORA);
  const contestadas = [];
  let fallada = null;
  for (let i = 0; i < 5; i++) {
    const id = s.current(AHORA).entry.id;
    const mal = i === 2;
    const r = s.answer({ grade: mal ? 1 : 3, correct: !mal, elapsedMs: 5000, usedHint: false }, AHORA);
    persistir(db, r.state);
    contestadas.push(id);
    if (mal) fallada = id;
  }
  const dos = await armarCon(99, 4, new Set(s.nuevasSinContestar()));
  const todas = [...ids(dos.due), ...ids(dos.fresh)];
  assert.ok(contestadas.filter((id) => id !== fallada).every((id) => !todas.includes(id)), 'las 4 acertadas no vuelven hoy');
  assert.ok(!todas.includes(fallada), 'la fallada tampoco vuelve hoy (ya se reinsertó en su sesión; vuelve mañana)');
  const pendientesAntes = ids(uno.fresh).filter((id) => !contestadas.includes(id));
  assert.notDeepEqual(ids(dos.fresh).slice(0, pendientesAntes.length), pendientesAntes, 'lo no contestado no sale en el mismo orden');
  assert.equal(contar(db, AHORA), 0, 'el conteo de HOY no cambia por cuáles salgan: ninguna vence hoy');
});

await prueba('las vencidas van en orden al azar e intercaladas con las nuevas, nunca todas las nuevas al final', () => {
  const due = pares(Array.from({ length: 12 }, (_, i) => ({ id: i + 1, ...graduada(i + 1, 12 - i) })));
  const fresh = pares([101, 102, 103, 104].map((id) => ({ id })));
  const orden = (sem) => {
    const s = new StudySession({ due, fresh, meta: 20, distractorsFor: () => [], intercalar: true, azar: azarFijo(sem) });
    const out = [];
    while (!s.terminada) {
      out.push(s.current().entry.id);
      s.skip();
    }
    return out;
  };
  const a = orden(1);
  const b = orden(2);
  assert.equal(a.length, 16);
  assert.notDeepEqual(a, b, 'otro azar, otro orden');
  const posNuevas = a.map((id, i) => (id > 100 ? i : -1)).filter((i) => i >= 0);
  assert.ok(posNuevas[0] < 8, 'las nuevas no esperan a que se acaben las vencidas');
  assert.ok(Math.max(...posNuevas) - Math.min(...posNuevas) >= 6, 'repartidas, no amontonadas');
  const soloVencidas = a.filter((id) => id <= 100);
  assert.notDeepEqual(soloVencidas, [...soloVencidas].sort((x, y) => x - y), 'las vencidas no van en su orden de siempre');
});

await prueba('sesión vacía: el motor no tiene tarjeta, ya está terminada y no deja nada pendiente', () => {
  const s = new StudySession({ due: [], fresh: [], meta: 20, distractorsFor: () => [], intercalar: true });
  assert.equal(s.current(), null);
  assert.equal(s.terminada, true);
  assert.deepEqual(s.nuevasSinContestar(), []);
  assert.deepEqual(s.progress, { done: 0, goal: 0 });
});

await prueba('estado final: próximo repaso (mañana si solo hay falladas de hoy) y nuevas que quedan en el catálogo', () => {
  const enDos = { ...graduada(1, 0), vence_en: fecha.startOfDay(AHORA + 2 * DIA) };
  const db = base({ entradas: 10, filas: [enDos] });
  const proximo = (d) => correr(d, sql.consultaProximoRepaso(1, FILTRO, AHORA))[0].proximo;
  assert.equal(proximo(db), fecha.startOfDay(AHORA + 2 * DIA));
  const fallada = { entry_id: 2, repeticiones: 0, intervalo: 0, vence_en: AHORA + 60_000, ultimo_repaso: AHORA - 1000, fallos: 1 };
  const db2 = base({ entradas: 10, filas: [enDos, fallada] });
  assert.equal(proximo(db2), fecha.startOfDay(fecha.addDays(AHORA, 1)), 'la fallada de hoy vuelve mañana, no en un minuto');
  assert.equal(proximo(base({ entradas: 10 })), null, 'sin tarjetas estudiadas no hay próximo repaso');
  assert.equal(correr(db2, sql.consultaContarNuevas(1, FILTRO))[0].n, 8);
});

await prueba('etiquetaProximoRepaso: mañana, en N días o la fecha (días de calendario)', () => {
  const noche = new Date(2026, 8, 19, 23, 30).getTime();
  assert.equal(etiquetaProximoRepaso(new Date(2026, 8, 20, 0, 0).getTime(), noche), 'mañana', 'a media hora sigue siendo mañana');
  assert.equal(etiquetaProximoRepaso(new Date(2026, 8, 22).getTime(), AHORA), 'en 3 días');
  assert.equal(etiquetaProximoRepaso(new Date(2026, 9, 12).getTime(), AHORA), 'el 12 de octubre');
  assert.equal(etiquetaProximoRepaso(AHORA + 60_000, AHORA), 'hoy');
});

// ── calificar ────────────────────────────────────────────────────────────
await prueba('calificar una frase la saca de vencidas y le pone fecha futura', () => {
  const db = base({ entradas: 5, filas: [graduada(1, 2)] });
  assert.equal(contar(db, AHORA), 1);
  const previo = estadoDe(consulta(db, 'SELECT * FROM tarjeta WHERE entry_id = 1', [])[0]);
  const { state } = sm2.review(previo, 3, AHORA);
  guardarFila(db, state);
  assert.equal(contar(db, AHORA), 0);
  assert.ok(state.vence_en > AHORA, 'la fecha nueva es futura');
  assert.equal(state.vence_en, fecha.startOfDay(state.vence_en), 'y cae al inicio de un día local');
});

await prueba('una respuesta fallada no vuelve a la cola de hoy', () => {
  const db = base({ entradas: 5, filas: [graduada(1, 2)] });
  const previo = estadoDe(consulta(db, 'SELECT * FROM tarjeta WHERE entry_id = 1', [])[0]);
  const { state } = sm2.review(previo, 1, AHORA);
  guardarFila(db, state);
  assert.equal(state.intervalo, 0);
  assert.equal(contar(db, AHORA + 2 * MIN), 0, 'aunque su fecha ya pasó, es de aprendizaje y respondida hoy');
  assert.equal(contar(db, AHORA + DIA), 1, 'mañana sí');
});

// ── medianoche y zonas horarias ──────────────────────────────────────────
await prueba('frontera de medianoche en Ciudad de México', () => {
  const contestada = new Date(2026, 8, 19, 23, 59, 0).getTime();
  const { state } = sm2.review({ ...sm2.newCardState(1), repeticiones: 2 }, 3, contestada);
  assert.equal(state.intervalo, 1);
  assert.equal(state.vence_en, new Date(2026, 8, 20, 0, 0, 0).getTime(), 'vence a las 00:00 de mañana');
  const db = base({ entradas: 3, filas: [state] });
  assert.equal(contar(db, new Date(2026, 8, 19, 23, 59, 30).getTime()), 0, 'a las 11:59 pm no aparece hoy');
  assert.equal(contar(db, new Date(2026, 8, 20, 0, 0, 0).getTime()), 1, 'a las 00:00 ya toca');
  assert.equal(contar(db, new Date(2026, 8, 20, 8, 0, 0).getTime()), 1, 'y no se pierde en la mañana');
});

await prueba('horario de verano de la frontera norte (Tijuana): el repaso de mañana cae mañana', () => {
  process.env.TZ = 'America/Tijuana';
  // 8 de marzo de 2026: el reloj salta una hora y el día dura 23 h.
  const sabado = new Date(2026, 2, 7, 23, 30, 0).getTime();
  assert.equal(fecha.addDays(sabado, 1), new Date(2026, 2, 8, 23, 30, 0).getTime());
  const { state } = sm2.review({ ...sm2.newCardState(1), repeticiones: 2 }, 3, sabado);
  assert.equal(state.vence_en, new Date(2026, 2, 8, 0, 0, 0).getTime(), 'vence el domingo 8 a las 00:00, no el lunes');
  // 1 de noviembre de 2026: el reloj retrocede y el día dura 25 h.
  const otono = new Date(2026, 9, 31, 23, 30, 0).getTime();
  const r = sm2.review({ ...sm2.newCardState(1), repeticiones: 2 }, 3, otono);
  assert.equal(r.state.vence_en, new Date(2026, 10, 1, 0, 0, 0).getTime());
});

// ── reinserción: solo las falladas, una vez ───────────────────────────────
// Tarjetas ya graduadas: contestarlas bien no las deja en aprendizaje.
const motor = (n, extra = {}) => new StudySession({ due: pares(Array.from({ length: n }, (_, i) => ({ id: i + 1, ...graduada(i + 1, 1) }))), fresh: [], meta: 50, distractorsFor: () => [], ...extra });
const responder = (s, bien) => {
  const id = s.current().entry.id;
  s.answer({ grade: bien ? 3 : 1, correct: bien, elapsedMs: 5000, usedHint: false });
  return id;
};
/** Recorre la sesión; `falla(id, vez)` dice si esa aparición se contesta mal. */
const recorrer = (s, falla) => {
  const vistas = [];
  const veces = new Map();
  while (!s.terminada) {
    const id = s.current().entry.id;
    const vez = (veces.get(id) ?? 0) + 1;
    veces.set(id, vez);
    vistas.push(responder(s, !falla(id, vez)));
  }
  return vistas;
};

await prueba('una tarjeta fallada vuelve una sola vez, 3 tarjetas después, y no dos', () => {
  const s = motor(8, { maxReinserciones: plan.MAX_REINSERCIONES, azar: () => 0 });
  const vistas = recorrer(s, (id) => id === 1); // la 1 falla siempre
  assert.deepEqual(vistas, [1, 2, 3, 4, 1, 5, 6, 7, 8]);
  assert.equal(s.totalReinserciones, 1);
});

await prueba('la fallada vuelve entre 3 y 5 tarjetas después', () => {
  for (const [azar, entre] of [[0, 3], [0.5, 4], [0.99, 5]]) {
    const s = motor(12, { maxReinserciones: 1, azar: () => azar });
    const vistas = recorrer(s, (id, vez) => id === 1 && vez === 1);
    assert.equal(vistas.indexOf(1, 1) - 1, entre, `azar ${azar}: ${entre} tarjetas entre las dos apariciones`);
  }
});

await prueba('una fallada que se corrige al volver no vuelve más', () => {
  const s = motor(8, { maxReinserciones: 1, azar: () => 0 });
  const vistas = recorrer(s, (id, vez) => id === 1 && vez === 1);
  assert.equal(vistas.filter((id) => id === 1).length, 2);
  assert.equal(s.totalReinserciones, 1);
});

await prueba('una acertada no vuelve, ni siquiera la que SM-2 deja en aprendizaje', () => {
  const nuevasTarjetas = pares(Array.from({ length: 8 }, (_, i) => ({ id: i + 1 })));
  const s = new StudySession({ due: [], fresh: nuevasTarjetas, meta: 50, distractorsFor: () => [], maxReinserciones: plan.MAX_REINSERCIONES, azar: () => 0 });
  const vistas = recorrer(s, () => false);
  assert.deepEqual(vistas, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(s.totalReinserciones, 0);
});

await prueba('sin reinserción configurada nada se repite en la sesión, ni las falladas', () => {
  const s = motor(6);
  assert.deepEqual(recorrer(s, () => true), [1, 2, 3, 4, 5, 6]);
  assert.equal(s.totalReinserciones, 0);
});

await prueba('la app reinserta las falladas una vez', () => {
  assert.equal(plan.MAX_REINSERCIONES, 1);
});

await prueba('`reinsertada` dice lo que hizo la sesión: la fallada vuelve una vez y nada más', () => {
  const s = motor(6, { maxReinserciones: 1, azar: () => 0 });
  const resultados = [];
  while (!s.terminada) {
    const id = s.current().entry.id;
    const r = s.answer({ grade: id === 1 ? 1 : 3, correct: id !== 1, elapsedMs: 5000, usedHint: false });
    resultados.push([id, r.reinsertada]);
  }
  assert.deepEqual(resultados.filter(([id]) => id === 1).map(([, re]) => re), [true, false], 'la primera falla vuelve, la segunda ya no');
  assert.ok(resultados.filter(([id]) => id !== 1).every(([, re]) => re === false), 'las acertadas no vuelven');
});

await prueba('un acierto en aprendizaje: SM-2 pide volver (requeue), la sesión no lo reinserta y queda para mañana (intervalo ≥ 1)', () => {
  const s = new StudySession({ due: [], fresh: pares([{ id: 1 }, { id: 2 }]), meta: 50, distractorsFor: () => [], maxReinserciones: 1, azar: () => 0 }, AHORA);
  const r = s.answer({ grade: 3, correct: true, elapsedMs: 5000, usedHint: false }, AHORA);
  assert.equal(r.requeue, true, 'SM-2 la deja en un paso de aprendizaje');
  assert.equal(r.reinsertada, false, 'pero la sesión no la vuelve a mostrar');
  assert.equal(r.state.intervalo, 1, 'una nueva acertada nunca queda con intervalo 0');
  assert.equal(r.state.vence_en, fecha.startOfDay(fecha.addDays(AHORA, 1)), 'vence al inicio de mañana');
  assert.equal(r.state.repeticiones, 1, 'SM-2 no cambia: la repetición cuenta igual');
  assert.equal(s.remaining, 1);
  // Y la fallada sigue como siempre: intervalo 0, vuelve en la sesión.
  const f = s.answer({ grade: 1, correct: false, elapsedMs: 5000, usedHint: false }, AHORA);
  assert.equal(f.state.intervalo, 0);
  assert.equal(f.reinsertada, true);
});

await prueba('sesionMerece: la regla de las partidas, 5 respuestas y 70%', () => {
  assert.equal(sesionMerece(4, 4), false, 'muy corta');
  assert.equal(sesionMerece(3, 5), false, '60%');
  assert.equal(sesionMerece(7, 10), true, '70% justo');
  assert.equal(sesionMerece(5, 5), true);
  assert.equal(sesionMerece(0, 0), false, 'sin respuestas no hay fiesta ni división por cero');
});

await prueba('etiquetaRepaso: «Vuelve en esta sesión» solo si de verdad vuelve', () => {
  assert.equal(etiquetaRepaso(0, true), 'Vuelve en esta sesión');
  assert.equal(etiquetaRepaso(0, false), 'La vuelves a ver pronto', 'intervalo 0 sin reinserción: se ve en la siguiente vuelta');
  assert.equal(etiquetaRepaso(1, false), 'La vuelves a ver mañana');
  assert.equal(etiquetaRepaso(3, false), 'La vuelves a ver en 3 días');
  assert.equal(etiquetaRepaso(7, false), 'La vuelves a ver en 1 semana');
  assert.equal(etiquetaRepaso(14, false), 'La vuelves a ver en 2 semanas');
  assert.equal(etiquetaRepaso(30, false), 'La vuelves a ver en 1 mes');
  assert.equal(etiquetaRepaso(60, false), 'La vuelves a ver en 2 meses');
});

await prueba('las reinsertadas no inflan la cola: el total sube solo lo reinsertado', () => {
  const s = motor(6, { maxReinserciones: 1, azar: () => 0 });
  const antes = s.progress.goal;
  responder(s, false);
  assert.equal(s.progress.goal, antes + 1);
});

// ── cola grande simulada ─────────────────────────────────────────────────
await prueba('cola de ~850 tras 30 días de uso (SM-2 real): sesión de 20 = 17 vencidas + 3 nuevas', async () => {
  let semilla = 12345;
  const azar = () => ((semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const rango = (n) => 1 + Math.floor(azar() * n);
  const filas = new Map();
  const califica = (id, t, juego) => {
    const previo = filas.get(id) ?? sm2.newCardState(id);
    const bien = azar() < 0.8;
    let g = sm2.gradeFrom(bien, 2000 + azar() * 13000, false);
    if (juego && g === 4) g = 3;
    filas.set(id, sm2.review(previo, g, t).state);
  };
  for (let d = 30; d >= 1; d--) {
    const dia = AHORA - d * DIA;
    for (let i = 0; i < 20; i++) califica(rango(1524), dia + i * 30_000, false);
    for (let i = 0; i < 20; i++) califica(rango(1524), dia + 3_600_000 + i * 20_000, true);
  }
  for (let puestas = 0; puestas < 15; ) {
    const id = rango(1524);
    if (!filas.has(id)) { filas.set(id, { ...sm2.newCardState(id), favorito: 1 }); puestas++; }
  }
  const db = base({ entradas: 1524, filas: [...filas.values()] });
  const { due, fresh } = await armar(db);
  const diag = diagnostico(db, AHORA);
  assert.ok(diag.vencidas > 700, `vencidas: ${diag.vencidas}`);
  assert.equal(diag.fantasma, 15);
  assert.deepEqual([due.length, fresh.length], [17, 3]);
  assert.deepEqual(ids(due), ids(vencidas(db, AHORA, 17)));
  if (INFORME) {
    console.log(`      informe: vencidas=${diag.vencidas} (de aprendizaje ${diag.aprendizaje}, fantasma ${diag.fantasma}); sesión: ${due.length} vencidas + ${fresh.length} nuevas`);
    // 300 sesiones con esa misma cola y 80 % de aciertos, con la regla de la app.
    const SESIONES = 300;
    let suma = 0, minimo = Infinity, maximo = 0, reinsertadas = 0;
    for (let k = 0; k < SESIONES; k++) {
      const s = new StudySession({ due: pares(due), fresh: pares(fresh), meta: 20, distractorsFor: () => [], maxReinserciones: plan.MAX_REINSERCIONES, azar });
      let respuestas = 0;
      while (!s.terminada) { const bien = azar() < 0.8; s.answer({ grade: bien ? 3 : 1, correct: bien, elapsedMs: 5000, usedHint: false }); respuestas++; }
      suma += respuestas; minimo = Math.min(minimo, respuestas); maximo = Math.max(maximo, respuestas); reinsertadas += s.totalReinserciones;
    }
    console.log(`      sesión típica de 20 (regla: falladas, 1 vez): ${(suma / SESIONES).toFixed(1)} respuestas en promedio (de ${minimo} a ${maximo}), ${(reinsertadas / SESIONES).toFixed(1)} reinsertadas por sesión`);
  }
});

// ── progreso por mundo ───────────────────────────────────────────────────
// 12 frases: calle 1-4 (la 2 es vulgar), dinero 5-8, tech 9-10 y gente 11-12 (las 9 a 12, de nivel 2).
function baseMundos() {
  const db = base({
    entradas: 12,
    nivelDe: (i) => (i >= 9 ? 2 : 1),
    filas: [{ entry_id: 1, dominada: 1 }, { entry_id: 2, dominada: 1 }, { entry_id: 3, dominada: 0 }, { entry_id: 6, dominada: 1 }, { entry_id: 9, dominada: 1 }],
  });
  db.run("UPDATE entrada SET mundo = 'calle' WHERE id BETWEEN 1 AND 4");
  db.run("UPDATE entrada SET mundo = 'dinero' WHERE id BETWEEN 5 AND 8");
  db.run("UPDATE entrada SET mundo = 'tech' WHERE id BETWEEN 9 AND 10");
  db.run("UPDATE entrada SET mundo = 'gente' WHERE id BETWEEN 11 AND 12");
  db.run('UPDATE entrada SET vulgaridad = 2 WHERE id = 2');
  return db;
}
const porMundo = (db, filtro) => Object.fromEntries(correr(db, sql.consultaProgresoPorMundo(1, filtro)).map((r) => [r.mundo, { total: r.total, dominadas: r.dominadas }]));

await prueba('progreso por mundo: total y dominadas de cada mundo; con 0 dominadas sale 0, no nulo', () => {
  const db = baseMundos();
  assert.deepEqual(porMundo(db, FILTRO), { calle: { total: 4, dominadas: 2 }, dinero: { total: 4, dominadas: 1 }, tech: { total: 2, dominadas: 1 }, gente: { total: 2, dominadas: 0 } });
});

await prueba('progreso por mundo: el Modo Limpio y el nivel filtran el total Y las dominadas', () => {
  const db = baseMundos();
  const limpio = porMundo(db, { modoLimpio: true, niveles: [1, 2, 3] });
  assert.deepEqual(limpio.calle, { total: 3, dominadas: 1 }, 'la vulgar sale de las dos cuentas');
  const nivel2 = porMundo(db, { modoLimpio: false, niveles: [2] });
  assert.deepEqual(nivel2, { tech: { total: 2, dominadas: 1 }, gente: { total: 2, dominadas: 0 } });
  for (const m of Object.values({ ...limpio, ...nivel2 })) assert.ok(m.dominadas <= m.total, 'nunca más dominadas que frases');
});

await prueba('progreso por mundo: solo cuentan las dominadas de ese usuario', () => {
  const db = baseMundos();
  const otro = { entry_id: 3, repeticiones: 0, intervalo: 0, facilidad: 2.5, vence_en: 0, ultimo_repaso: null, fallos: 0, aciertos: 0, dominada: 1, favorito: 0 };
  db.run(sql.SQL_UPSERT_TARJETA, sql.paramsUpsertTarjeta(2, otro));
  assert.deepEqual(porMundo(db, FILTRO).calle, { total: 4, dominadas: 2 });
});

// ── notificaciones: tokens con nombre ────────────────────────────────────
const notif = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/notificaciones.json'), 'utf8'));
const TODAS = [...notif.plantillas, ...notif.vuelta];
// Cada dato con un número distinto, para ver si cae en el lugar de otro.
const EJEMPLO = { phrase: 'out of pocket', vencidas: 840, racha: 4, dominadas: 37, faltan: 12, titulo: 'Tiempos verbales', lo_que_dices: 'I am agree' };

await prueba('cada plantilla de notificación usa solo tokens que existen', () => {
  for (const t of TODAS) assert.deepEqual(plantillas.tokensDesconocidos(t.texto), [], t.id);
});

await prueba('cada número de una notificación cae en su lugar (vencidas 840, racha 4, dominadas 37, faltan 12)', () => {
  for (const t of TODAS) {
    const texto = plantillas.rellena(t.texto, EJEMPLO);
    assert.ok(texto, `${t.id} se rellena con los datos de ejemplo`);
    assert.ok(!/[{}]/.test(texto), `${t.id} no deja llaves: ${texto}`);
    for (const nombre of ['vencidas', 'racha', 'dominadas', 'faltan']) {
      const aparece = new RegExp(`\\b${EJEMPLO[nombre]}\\b`).test(texto);
      assert.equal(aparece, plantillas.tokensDe(t.texto).includes(nombre), `${t.id}: el número de {${nombre}} ${aparece ? 'sobra' : 'falta'} en "${texto}"`);
    }
  }
  assert.equal(plantillas.rellena(notif.plantillas.find((t) => t.id === 'not_racha').texto, EJEMPLO), 'Llevas 4 días seguidos');
  assert.equal(plantillas.rellena(notif.vuelta.find((t) => t.id === 'not_vuelta_7').texto, EJEMPLO), 'Llevas 37 frases dominadas y siguen aquí.');
  assert.equal(plantillas.rellena('V={vencidas} R={racha} D={dominadas} F={faltan}', EJEMPLO), 'V=840 R=4 D=37 F=12');
});

await prueba('un token que no existe truena y un dato que falta descarta la plantilla', () => {
  assert.throws(() => plantillas.rellena('Llevas {racah} días', EJEMPLO), /Token desconocido/);
  assert.equal(plantillas.rellena('Llevas {racha} días', { ...EJEMPLO, racha: 0 }), null, 'racha en cero');
  assert.equal(plantillas.rellena('Llevas {racha} días', {}), null, 'sin dato');
  assert.equal(plantillas.rellena('¿Sabes qué significa "{phrase}"?', { phrase: '  ' }), null, 'texto vacío');
  assert.equal(plantillas.rellena('Hay frases por repasar hoy.', {}), 'Hay frases por repasar hoy.', 'sin tokens no pide nada');
});

await prueba('las plantillas respetan las reglas de tono del propio JSON (sin "estudiar" ni "deber")', () => {
  for (const t of TODAS) assert.ok(!/estudi|deber/i.test(t.texto), `${t.id}: ${t.texto}`);
});

console.log(`check:srs ok (${total} pruebas)`);
