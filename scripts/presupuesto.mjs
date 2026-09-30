/**
 * Compara el tamaño del bundle de JS (Hermes), de los assets empaquetados y del AAB contra scripts/presupuestos.json.
 * Sale con error si alguno se pasa; avisa si queda a menos del 3 % del tope.
 *
 *   node scripts/presupuesto.mjs                 # hace `expo export` (android, producción) y mide el .hbc y los assets
 *   node scripts/presupuesto.mjs --export dist   # mide un export ya hecho en esa carpeta
 *   node scripts/presupuesto.mjs --aab ruta.aab  # mide además el AAB (android/app/build/outputs/bundle/release/)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const presupuesto = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/presupuestos.json'), 'utf8'));
const args = process.argv.slice(2);
const valor = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};

function peso(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? peso(p) : fs.statSync(p).size;
  }
  return total;
}
function buscar(dir, re) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = buscar(p, re);
      if (r) return r;
    } else if (re.test(e.name)) return p;
  }
  return null;
}

let salida = valor('--export');
if (!salida) {
  salida = fs.mkdtempSync(path.join(os.tmpdir(), 'wero-export-'));
  console.log(`expo export → ${salida} …`);
  execSync(`npx expo export --platform android --output-dir "${salida}"`, {
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production' },
  });
}

const hbc = buscar(salida, /\.hbc$/);
if (!hbc) {
  console.error(`No hay .hbc en ${salida}`);
  process.exit(1);
}
const medidas = [
  ['Bundle de JS (Hermes)', fs.statSync(hbc).size, presupuesto.hermesBytes],
  ['Assets empaquetados', fs.existsSync(path.join(salida, 'assets')) ? peso(path.join(salida, 'assets')) : 0, presupuesto.assetsBytes],
];
const aab = valor('--aab');
if (aab) medidas.push(['AAB release', fs.statSync(aab).size, presupuesto.aabBytes]);

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
let pasado = false;
for (const [nombre, real, tope] of medidas) {
  if (tope == null) {
    console.log(`  ${nombre.padEnd(24)} ${mb(real)}  (sin presupuesto: anótalo en scripts/presupuestos.json)`);
    continue;
  }
  const uso = real / tope;
  const marca = uso > 1 ? 'SE PASA' : uso > 0.97 ? 'cerca' : 'ok';
  if (uso > 1) pasado = true;
  console.log(`  ${nombre.padEnd(24)} ${mb(real)} de ${mb(tope)} (${Math.round(uso * 100)} %)  ${marca}`);
}
if (pasado) {
  console.error('\nSe pasó un presupuesto: busca qué creció (Expo Atlas) antes de subir el tope.');
  process.exit(1);
}
