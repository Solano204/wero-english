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
const { StudySession } = await importar('src/domain/session.ts');
const plan = await importar('src/domain/cola.ts');
const sql = await importar('src/db/cola.ts');
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
const nuevas = (db, limite, filtro = FILTRO) => correr(db, sql.consultaNuevas(1, filtro, limite));
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
  assert.deepEqual(ids(nuevas(db, 10)), [1, 2, 3, 4, 5]);
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

console.log(`check:srs ok (${total} pruebas)`);
