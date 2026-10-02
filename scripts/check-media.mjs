/**
 * Compara los medios que tienes en assets/ contra los que tus JSON
 * esperan. Dice qué falta, qué sobra y cuánto ocupa lo que ya está.
 *
 *   npm run check:media            resumen
 *   npm run check:media -- 18 22   revisa solo esas entradas
 *   npm run check:media -- --list  imprime los nombres que faltan
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'assets/data');
const ASSETS = path.join(ROOT, 'assets');

const args = process.argv.slice(2);
const wantList = args.includes('--list');
const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);

function read(f) {
  const p = path.join(DATA, f);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

/* ---------- lo que los JSON esperan ---------- */

const esperado = new Map(); // ruta -> de dónde viene

function want(ruta, origen) {
  if (ruta) esperado.set(ruta, origen);
}

const cat = read('catalogo.json');
if (cat?.entries) {
  for (const e of cat.entries) {
    if (ids.length && !ids.includes(e.id)) continue;
    want(e.audio_en, `entrada ${e.id}`);
    want(e.audio_es, `entrada ${e.id}`);
    want(e.imagen, `entrada ${e.id}`);
    for (const p of e.palabras_practica ?? []) want(p.audio, `práctica ${e.id}`);
  }
}

if (!ids.length) {
  const fon = read('fonemas.json');
  for (const f of fon?.fonemas ?? []) {
    // audio_manual: true = pendiente de grabación humana, no se espera aún.
    if (!f.audio_manual) {
      want(f.audio, `fonema ${f.id}`);
      want(f.audio_lento, `fonema ${f.id}`);
    }
    want(f.imagen, `fonema ${f.id}`);
    for (const e of f.ejemplos ?? []) want(e.audio, `fonema ${f.id}`);
    for (const p of f.pares_minimos ?? []) {
      want(p.audio_a, `par ${f.id}`);
      want(p.audio_b, `par ${f.id}`);
    }
  }
  for (const r of fon?.reglas ?? []) {
    want(r.imagen, `regla ${r.id}`);
    for (const c of r.casos ?? []) {
      for (const e of c.ejemplos ?? []) want(e.audio, `regla ${r.id}`);
    }
  }

  const err = read('errores.json');
  for (const e of err?.errores ?? []) {
    want(e.audio, `error ${e.id}`);
    want(e.audio_contraste_archivo, `error ${e.id}`);
    want(e.imagen, `error ${e.id}`);
  }

  const con = read('contracciones.json');
  for (const c of con?.cazala ?? []) {
    want(c.audio, `cázala ${c.id}`);
    want(c.audio_lento, `cázala ${c.id}`);
    want(c.audio_es, `cázala ${c.id}`);
  }

  const lec = read('lecturas.json');
  for (const l of lec?.lecturas ?? []) {
    for (const c of l.capitulos ?? []) want(c.audio, `lectura ${l.id}`);
  }

  const portadas = path.join(ROOT, 'src/theme/portadas.ts');
  if (fs.existsSync(portadas)) {
    for (const m of fs.readFileSync(portadas, 'utf8').matchAll(/'(img\/[^']+)'/g)) want(m[1], 'portadas.ts');
  }

  const sit = read('situaciones.json');
  for (const a of sit?.arquetipos ?? []) want(a.imagen, `situación ${a.id}`);
  for (const e of sit?.escenarios ?? []) want(e.imagen, `escenario ${e.id}`);

  const gram = read('gramatica.json');
  for (const t of gram?.temas ?? []) {
    for (const e of t.ejemplos ?? []) {
      want(e.audio, `gramática ${t.id}`);
      want(e.audio_es, `gramática ${t.id}`);
      want(e.audio_lento, `gramática ${t.id}`);
    }
    want(t.error_tipico?.audio_bien, `gramática ${t.id}`);
  }

  const phr = read('phrasal_verbs.json');
  for (const v of phr?.verbos ?? []) {
    want(v.audio_frase, `phrasal ${v.id}`);
    want(v.audio_frase_lento, `phrasal ${v.id}`);
    want(v.audio_significado, `phrasal ${v.id}`);
    want(v.audio_ejemplo, `phrasal ${v.id}`);
    want(v.audio_ejemplo_lento, `phrasal ${v.id}`);
    want(v.audio_traduccion, `phrasal ${v.id}`);
  }
}

/* ---------- lo que tienes en disco ---------- */

function walk(dir, base, out = new Map()) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    // Igual que build-asset-map: las carpetas "_*" no cuentan.
    if (e.isDirectory()) {
      if (!e.name.startsWith('_')) walk(full, base, out);
    } else if (/\.(mp3|m4a|webp|png|jpg)$/i.test(e.name)) {
      const rel = path.relative(base, full).split(path.sep).join('/');
      out.set(rel, fs.statSync(full).size);
    }
  }
  return out;
}

const tengo = new Map([
  ...walk(path.join(ASSETS, 'aud'), ASSETS),
  ...walk(path.join(ASSETS, 'img'), ASSETS),
]);

/* ---------- comparación ---------- */

const faltan = [...esperado.keys()].filter((r) => !tengo.has(r));
const sobran = [...tengo.keys()].filter((r) => !esperado.has(r));
const listos = [...esperado.keys()].filter((r) => tengo.has(r));

const bytes = listos.reduce((s, r) => s + (tengo.get(r) ?? 0), 0);
const chicos = listos.filter((r) => (tengo.get(r) ?? 0) < 3000);

console.log('');
if (esperado.size === 0) {
  console.log('Los JSON de assets/data están vacíos: nada que comparar.\n');
  process.exit(0);
}

console.log(`esperados por los JSON : ${esperado.size}`);
console.log(`ya los tienes          : ${listos.length}`);
console.log(`faltan                 : ${faltan.length}`);
console.log(`sobran en assets/      : ${sobran.length}`);
console.log(`peso de lo que hay     : ${(bytes / 1048576).toFixed(1)} MB`);

if (chicos.length) {
  console.log(`\nAVISO: ${chicos.length} archivos pesan menos de 3 KB.`);
  console.log('  Suele ser un fallo silencioso de la API que los generó.');
  for (const c of chicos.slice(0, 5)) {
    console.log(`    ${c}  ${tengo.get(c)} bytes`);
  }
}

if (sobran.length) {
  console.log(`\nSOBRAN (ningún JSON los pide):`);
  for (const s of sobran.slice(0, 10)) console.log(`    ${s}`);
  if (sobran.length > 10) console.log(`    … y ${sobran.length - 10} más`);
  console.log('  Revisa el nombre: probablemente falta o sobra un cero.');
}

if (faltan.length && wantList) {
  console.log(`\nFALTAN:`);
  for (const f of faltan) console.log(`    ${f}   (${esperado.get(f)})`);
} else if (faltan.length) {
  console.log(`\nPara ver la lista completa:  npm run check:media -- --list`);
  console.log('Primeros que faltan:');
  for (const f of faltan.slice(0, 8)) {
    console.log(`    ${f}   (${esperado.get(f)})`);
  }
}

// El mapa está partido: src/assets/bundled.ts (el índice por paquete) y un módulo por paquete en src/assets/medios/.
const mapaDir = path.join(ROOT, 'src/assets/medios');
if (listos.length > 0 && fs.existsSync(path.join(ROOT, 'src/assets/bundled.ts'))) {
  const modulos = fs.existsSync(mapaDir) ? fs.readdirSync(mapaDir).filter((n) => n.endsWith('.ts')) : [];
  const enMapa = modulos.reduce(
    (n, m) => n + (fs.readFileSync(path.join(mapaDir, m), 'utf8').match(/require\('@assets\//g) ?? []).length,
    0
  );
  if (enMapa !== tengo.size) {
    console.log(
      `\nEl mapa tiene ${enMapa} archivos y en assets/ hay ${tengo.size}.`
    );
    console.log('Corre:  npm run build:assets');
  }
}

console.log('');
