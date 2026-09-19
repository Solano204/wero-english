/**
 * Valida assets/data/phrasal_verbs.json:
 *  - sin (frase + significado) duplicados (un mismo phrasal puede tener
 *    más de un significado usado, ej. "take off"; lo que no puede
 *    repetirse es la MISMA combinación frase+significado)
 *  - grupos coherentes: cuantos === ids.length, ids existen en verbos,
 *    cada verbo de "verbos" cae en algún grupo, total === verbos.length
 *  - campos obligatorios llenos (frase, significado, ejemplo,
 *    traduccion; nota puede faltar, pero si viene no debe ir vacía)
 *  - el ejemplo contiene la frase, tolerando conjugaciones irregulares
 *    y separables (pick it up, got up, gets up)
 *
 *   npm run check:phrasal
 */
import fs from 'node:fs';
import path from 'node:path';

// Acepta una ruta alterna como argumento, para validar una propuesta
// antes de guardarla encima del archivo real.
const PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.cwd(), 'assets/data/phrasal_verbs.json');
const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));

// Formas conocidas de los verbos irregulares que aparecen en el
// dataset. Los regulares se derivan con reglas simples más abajo.
const IRREGULARES = {
  get: ['get', 'gets', 'getting', 'got', 'gotten'],
  take: ['take', 'takes', 'taking', 'took', 'taken'],
  come: ['come', 'comes', 'coming', 'came'],
  go: ['go', 'goes', 'going', 'went', 'gone'],
  break: ['break', 'breaks', 'breaking', 'broke', 'broken'],
  put: ['put', 'puts', 'putting'],
  run: ['run', 'runs', 'running', 'ran'],
  hold: ['hold', 'holds', 'holding', 'held'],
  let: ['let', 'lets', 'letting'],
  make: ['make', 'makes', 'making', 'made'],
  cut: ['cut', 'cuts', 'cutting'],
  stand: ['stand', 'stands', 'standing', 'stood'],
  fall: ['fall', 'falls', 'falling', 'fell', 'fallen'],
  bring: ['bring', 'brings', 'bringing', 'brought'],
  catch: ['catch', 'catches', 'catching', 'caught'],
  keep: ['keep', 'keeps', 'keeping', 'kept'],
  lay: ['lay', 'lays', 'laying', 'laid'],
  pay: ['pay', 'pays', 'paying', 'paid'],
  sit: ['sit', 'sits', 'sitting', 'sat'],
  wake: ['wake', 'wakes', 'waking', 'woke', 'woken'],
  throw: ['throw', 'throws', 'throwing', 'threw', 'thrown'],
  blow: ['blow', 'blows', 'blowing', 'blew', 'blown'],
  wear: ['wear', 'wears', 'wearing', 'wore', 'worn'],
  give: ['give', 'gives', 'giving', 'gave', 'given'],
  set: ['set', 'sets', 'setting'],
  shut: ['shut', 'shuts', 'shutting'],
  show: ['show', 'shows', 'showing', 'showed', 'shown'],
  hang: ['hang', 'hangs', 'hanging', 'hung'],
};

/** Reglas simples de -s / -ing / -ed para verbos regulares. */
function formasRegulares(v) {
  const base = v;
  const s = /[sxzh]$|[^aeiou]o$/.test(v) ? v + 'es' : v + 's';
  let ing;
  let ed;
  if (v.endsWith('e') && !v.endsWith('ee')) {
    ing = v.slice(0, -1) + 'ing';
    ed = v.slice(0, -1) + 'ed';
  } else if (/[^aeiou][aeiou][bdgklmnprt]$/.test(v) && v.length <= 5) {
    // consonante-vocal-consonante corta: dobla la última (drop -> dropping)
    ing = v + v[v.length - 1] + 'ing';
    ed = v + v[v.length - 1] + 'ed';
  } else if (v.endsWith('y') && !/[aeiou]y$/.test(v)) {
    ing = v + 'ing';
    ed = v.slice(0, -1) + 'ied';
  } else {
    ing = v + 'ing';
    ed = v + 'ed';
  }
  return [base, s, ing, ed];
}

function formasDe(verbo) {
  return IRREGULARES[verbo] ?? formasRegulares(verbo);
}

function normaliza(s) {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.,!?¡¿"“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿El ejemplo trae alguna forma del verbo, seguida en algún punto por las palabras de la partícula, en orden? */
function ejemploContieneFrase(ejemplo, verbo, particula) {
  const palabras = normaliza(ejemplo).split(' ');
  const formas = new Set(formasDe(verbo));
  const idxVerbo = palabras.findIndex((p) => formas.has(p));
  if (idxVerbo === -1) return false;

  const partes = normaliza(particula).split(' ');
  let cursor = idxVerbo + 1;
  for (const parte of partes) {
    const pos = palabras.indexOf(parte, cursor);
    if (pos === -1) return false;
    cursor = pos + 1;
  }
  return true;
}

const errores = [];

// ---- esquema de grupos/verbos ----
const porId = new Map(data.verbos.map((v) => [v.id, v]));

if (data.verbos.length !== data.total) {
  errores.push(`total dice ${data.total} pero hay ${data.verbos.length} verbos`);
}

const idsEnGrupos = new Set();
for (const g of data.grupos) {
  if (g.cuantos !== g.ids.length) {
    errores.push(`grupo "${g.verbo}": cuantos=${g.cuantos} pero ids.length=${g.ids.length}`);
  }
  for (const id of g.ids) {
    if (idsEnGrupos.has(id)) errores.push(`id ${id} aparece en más de un grupo`);
    idsEnGrupos.add(id);
    const v = porId.get(id);
    if (!v) {
      errores.push(`grupo "${g.verbo}": id ${id} no existe en verbos`);
    } else if (v.verbo !== g.verbo) {
      errores.push(`id ${id}: verbo "${v.verbo}" no coincide con su grupo "${g.verbo}"`);
    }
  }
}
for (const v of data.verbos) {
  if (!idsEnGrupos.has(v.id)) errores.push(`id ${v.id} (${v.frase}) no está en ningún grupo`);
}

// ---- por entrada ----
const vistos = new Map(); // "frase|significado" normalizado -> id

for (const v of data.verbos) {
  const falta = ['verbo', 'particula', 'frase', 'significado', 'ejemplo', 'traduccion'].filter(
    (campo) => !String(v[campo] ?? '').trim()
  );
  if (falta.length) errores.push(`id ${v.id}: faltan campos: ${falta.join(', ')}`);

  if (![0, 1, 2].includes(v.vulgaridad)) {
    errores.push(`id ${v.id}: vulgaridad inválida (${v.vulgaridad})`);
  }
  if (typeof v.separable !== 'boolean') {
    errores.push(`id ${v.id}: separable debe ser boolean`);
  }

  const esperada = `${v.verbo} ${v.particula}`;
  if (v.frase !== esperada) {
    errores.push(`id ${v.id}: frase "${v.frase}" no coincide con verbo+particula ("${esperada}")`);
  }

  const clave = `${normaliza(v.frase)}|${normaliza(v.significado)}`;
  if (vistos.has(clave)) {
    errores.push(`id ${v.id} duplica frase+significado con id ${vistos.get(clave)} ("${v.frase}": ${v.significado})`);
  }
  vistos.set(clave, v.id);

  if (v.ejemplo && !ejemploContieneFrase(v.ejemplo, v.verbo, v.particula)) {
    errores.push(`id ${v.id}: el ejemplo no contiene "${v.frase}" ("${v.ejemplo}")`);
  }

  const palabrasEjemplo = v.ejemplo.trim().split(/\s+/).length;
  if (palabrasEjemplo > 12) {
    errores.push(`id ${v.id}: ejemplo muy largo (${palabrasEjemplo} palabras): "${v.ejemplo}"`);
  }
}

console.log(`\nPHRASAL VERBS: ${data.verbos.length} entradas, ${data.grupos.length} verbos\n`);

if (errores.length) {
  console.log(`${errores.length} error(es):\n`);
  for (const e of errores) console.log(`  - ${e}`);
  console.log('');
  process.exit(1);
}

console.log('OK: sin duplicados, grupos coherentes, campos completos, ejemplos consistentes.\n');
