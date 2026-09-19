/**
 * Revisa que todo import con alias @/ resuelva a un archivo real,
 * y que no haya ciclos entre módulos.
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
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // paquete de node_modules

  for (const e of ['', ...EXT, ...EXT.map((x) => '/index' + x)]) {
    if (fs.existsSync(base + e) && fs.statSync(base + e).isFile()) return base + e;
  }
  return false;
}

const files = [...walk(SRC), path.join(ROOT, 'App.tsx')];
const graph = new Map();
const broken = [];
// Regla: los íconos entran solo por components/base/Icon.tsx.
const PUERTA_ICONOS = path.join(SRC, 'components', 'base', 'Icon.tsx');
const iconosSueltos = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const deps = [];
  const re = /(?:from\s+|require\()\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    if (spec.startsWith('phosphor-react-native') && f !== PUERTA_ICONOS) {
      iconosSueltos.push(`${path.relative(ROOT, f)} -> ${spec}`);
    }
    const target = resolve(spec, f);
    if (target === false) broken.push(`${path.relative(ROOT, f)} -> ${spec}`);
    else if (target) deps.push(target);
  }
  graph.set(f, deps);
}

console.log(`archivos analizados: ${files.length}`);
console.log(`imports rotos: ${broken.length}`);
for (const b of broken) console.log(`  ${b}`);
console.log(`phosphor-react-native fuera de Icon.tsx: ${iconosSueltos.length}`);
for (const i of iconosSueltos) console.log(`  ${i}`);

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

process.exit(broken.length === 0 && cycles.length === 0 && iconosSueltos.length === 0 ? 0 : 1);
