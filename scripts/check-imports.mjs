/**
 * Revisa los imports de src/:
 *  1. todo import con alias @/ (o relativo) resuelve a un archivo real;
 *  2. no hay ciclos entre módulos;
 *  3. los íconos entran solo por shared/ui/Icon.tsx;
 *  4. las reglas de capas de docs/ARQUITECTURA.md (qué puede importar a qué);
 *  5. una feature no importa archivos internos de otra;
 *  6. domain es puro: ni React, ni React Native, ni Expo, ni otro paquete.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const EXT = ['.ts', '.tsx', '.js', '.json'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function resolve(spec, from) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('@data/')) base = path.join(ROOT, 'assets/data', spec.slice(6));
  else if (spec.startsWith('@assets/')) base = path.join(ROOT, 'assets', spec.slice(8));
  else if (spec.startsWith('@modules/')) base = path.join(ROOT, 'modules', spec.slice(9));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // paquete de node_modules

  for (const e of ['', ...EXT, ...EXT.map((x) => '/index' + x)]) {
    if (fs.existsSync(base + e) && fs.statSync(base + e).isFile()) return base + e;
  }
  return false;
}

/** La capa de un archivo de src/: la primera carpeta (app, features, estado, shared, data, services, domain…). */
const capaDe = (f) => path.relative(SRC, f).split(path.sep)[0];

/**
 * Qué puede importar cada capa (además de sí misma). `theme`, `config` y `types` los puede importar
 * cualquiera; `assets` es el mapa de medios (solo lo leen services y data).
 */
const PERMITIDO = {
  app: ['features', 'estado', 'shared', 'data', 'services', 'domain', 'theme', 'config', 'types', 'assets'],
  features: ['estado', 'shared', 'data', 'services', 'domain', 'theme', 'config', 'types'],
  estado: ['data', 'services', 'domain', 'theme', 'config', 'types'],
  shared: ['services', 'domain', 'theme', 'config', 'types'],
  services: ['data', 'domain', 'theme', 'config', 'types', 'assets'],
  data: ['domain', 'config', 'types'],
  domain: ['types'],
  theme: ['types'],
  config: ['types'],
  types: [],
  assets: [],
};

/** La feature de un archivo: `features/juegos` cuenta como una sola (sus juegos comparten juegos/comun). */
const featureDe = (f) => {
  const partes = path.relative(SRC, f).split(path.sep);
  return partes[0] === 'features' ? partes[1] : null;
};

/** Paquetes que sí puede usar domain (ninguno de React, React Native ni Expo). */
const DOMAIN_PAQUETES = new Set([]);

const files = walk(SRC);
const graph = new Map();
const broken = [];
const PUERTA_ICONOS = path.join(SRC, 'shared', 'ui', 'Icon.tsx');
const iconosSueltos = [];
const capas = [];
const entreFeatures = [];
const domainImpuro = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const deps = [];
  const re = /(?:from\s+|require\()\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    const rel = path.relative(ROOT, f);
    if (spec.startsWith('phosphor-react-native') && f !== PUERTA_ICONOS) iconosSueltos.push(`${rel} -> ${spec}`);
    const target = resolve(spec, f);
    // `import type` se borra al compilar: se revisa que resuelva y las capas, pero no cuenta para los ciclos.
    const inicio = src.lastIndexOf('\n', m.index) + 1;
    const soloTipos = /^\s*(?:import|export)\s+type\b/.test(src.slice(inicio, m.index));
    if (target === false) {
      broken.push(`${rel} -> ${spec}`);
      continue;
    }
    if (target === null) {
      if (capaDe(f) === 'domain' && !soloTipos && !DOMAIN_PAQUETES.has(spec)) domainImpuro.push(`${rel} -> ${spec}`);
      continue;
    }
    if (target.startsWith(SRC + path.sep)) {
      const de = capaDe(f);
      const a = capaDe(target);
      if (de !== a && !(PERMITIDO[de] ?? []).includes(a)) capas.push(`${rel} -> ${spec}  (${de} no puede importar ${a})`);
      const fd = featureDe(f);
      const fa = featureDe(target);
      if (fd && fa && fd !== fa) entreFeatures.push(`${rel} -> ${spec}  (${fd} → ${fa})`);
    }
    if (!soloTipos) deps.push(target);
  }
  graph.set(f, deps);
}

const lista = (titulo, xs) => {
  console.log(`${titulo}: ${xs.length}`);
  for (const x of xs.slice(0, 40)) console.log(`  ${x}`);
};
console.log(`archivos analizados: ${files.length}`);
lista('imports rotos', broken);
lista('phosphor-react-native fuera de Icon.tsx', iconosSueltos);
lista('imports que rompen las capas', capas);
lista('imports entre features', entreFeatures);
lista('paquetes en domain', domainImpuro);

// Detección de ciclos con DFS
const WHITE = 0, GRAY = 1, BLACK = 2;
const state = new Map(files.map((f) => [f, WHITE]));
const cycles = [];

function dfs(node, stack) {
  state.set(node, GRAY);
  stack.push(node);
  for (const d of graph.get(node) ?? []) {
    if (!state.has(d)) continue;
    if (state.get(d) === GRAY) {
      const i = stack.indexOf(d);
      cycles.push(stack.slice(i).concat(d).map((x) => path.relative(SRC, x)));
    } else if (state.get(d) === WHITE) {
      dfs(d, stack);
    }
  }
  stack.pop();
  state.set(node, BLACK);
}

for (const f of files) if (state.get(f) === WHITE) dfs(f, []);

console.log(`ciclos: ${cycles.length}`);
for (const c of cycles.slice(0, 10)) console.log('  ' + c.join(' -> '));

const problemas = broken.length + cycles.length + iconosSueltos.length + capas.length + entreFeatures.length + domainImpuro.length;
process.exit(problemas === 0 ? 0 : 1);
