/**
 * Valida los JSON de assets/data antes de correr la app.
 * Dice qué falta y qué tiene forma incorrecta, sin abrir el emulador.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'assets/data');

const SPEC = [
  { file: 'catalogo.json', key: 'entries', label: 'entradas', min: 1 },
  { file: 'packs.json', key: 'packs', label: 'packs', min: 1 },
  { file: 'situaciones.json', key: 'escenarios', label: 'escenarios', min: 1 },
  { file: 'contracciones.json', key: 'grupos', label: 'grupos', min: 1 },
  { file: 'errores.json', key: 'errores', label: 'tarjetas', min: 1 },
  { file: 'fonemas.json', key: 'fonemas', label: 'fonemas', min: 1 },
  { file: 'notificaciones.json', key: 'plantillas', label: 'plantillas', min: 1 },
  { file: 'lecturas.json', key: 'lecturas', label: 'historias', min: 1 },
  { file: 'niveles.json', key: 'juegos', label: 'juegos con niveles', min: 1 },
  { file: 'phrasal_verbs.json', key: 'verbos', label: 'phrasal verbs', min: 1 },
];

let listo = 0;
console.log('\nESTADO DE assets/data\n');

for (const s of SPEC) {
  const p = path.join(DIR, s.file);
  if (!fs.existsSync(p)) {
    console.log(`  FALTA   ${s.file}`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.log(`  ROTO    ${s.file}  ${e.message.slice(0, 60)}`);
    continue;
  }
  // niveles.json guarda un objeto por juego, no una lista: se cuenta
  // por número de llaves en vez de por longitud.
  const bruto = data[s.key];
  const arr =
    Array.isArray(bruto) || bruto == null
      ? bruto
      : Object.keys(bruto);
  if (!Array.isArray(arr)) {
    console.log(`  FORMA   ${s.file}  falta la clave "${s.key}"`);
    continue;
  }
  if (arr.length < s.min) {
    console.log(`  VACIO   ${s.file}  0 ${s.label}`);
    continue;
  }
  console.log(`  ok      ${s.file}  ${arr.length} ${s.label}`);
  listo++;
}

console.log(`\n${listo} de ${SPEC.length} archivos con contenido\n`);

// Comprobaciones cruzadas, solo si hay datos
const cat = read('catalogo.json');
const packs = read('packs.json');
const sit = read('situaciones.json');

if (cat?.entries?.length && packs?.packs?.length) {
  const ids = new Set(packs.packs.map((p) => p.id));
  const huerfanas = cat.entries.filter((e) => !ids.has(e.pack_final));
  if (huerfanas.length) {
    console.log(
      `AVISO: ${huerfanas.length} entradas apuntan a un pack_final que no existe`
    );
    console.log(`  ejemplo: id ${huerfanas[0].id} -> "${huerfanas[0].pack_final}"`);
  } else {
    console.log('ok: todas las entradas tienen un pack válido');
  }

  const suma = packs.packs.reduce((s, p) => s + (p.total_entradas ?? 0), 0);
  if (suma !== cat.entries.length) {
    console.log(
      `AVISO: los packs suman ${suma} y el catálogo tiene ${cat.entries.length}`
    );
  }
}

if (sit?.escenarios?.length && sit?.arquetipos?.length) {
  const arq = new Set(sit.arquetipos.map((a) => a.id));
  const malos = sit.escenarios.filter((e) => !arq.has(e.arquetipo));
  if (malos.length) {
    console.log(`AVISO: ${malos.length} escenarios sin arquetipo válido`);
  } else {
    console.log('ok: todos los escenarios tienen arquetipo');
  }
}

console.log('');

function read(f) {
  const p = path.join(DIR, f);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
