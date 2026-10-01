/**
 * check:worklets — que ningún worklet llame (ni deje que Reanimated llame) a una función de JS desde el hilo de UI.
 *
 * Compila cada archivo de src/ igual que el build release (babel.config.js con React Compiler y el plugin de
 * worklets) y revisa el resultado, no el fuente: el crash «[Worklets] Tried to synchronously call a Remote
 * Function» salía de código que en el fuente se veía bien. El React Compiler sacaba un callback anidado de
 * withTiming a una función de módulo (`_temp3`), el worklet de afuera la capturaba como función de JS y, al
 * terminar la animación, Reanimated la llamaba en el hilo de UI.
 *
 * Falla si encuentra:
 *  1. Un worklet que captura una función de JS (local, importada de la app, prop, setState, navegación…) y la usa
 *     sin pasar por runOnJS / scheduleOnRN (llamarla o dársela a una animación como callback truenan igual).
 *  2. Una API de animación (withTiming, withSpring, withDecay, withRepeat, useAnimatedReaction,
 *     useFrameCallback, useDerivedValue, useAnimatedStyle, useAnimatedProps, useAnimatedScrollHandler, runOnUI,
 *     scheduleOnUI) que recibe una función que no quedó convertida en worklet.
 *
 *   npm run check:worklets
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

/** Las mismas condiciones con las que Metro compila el APK release. */
const CALLER = {
  name: 'metro',
  platform: 'android',
  bundler: 'metro',
  supportsReactCompiler: true,
  isDev: false,
  isServer: false,
  supportsStaticESM: false,
};

const API_ANIMACION = new Set([
  'withTiming', 'withSpring', 'withDecay', 'withRepeat',
  'useAnimatedReaction', 'useFrameCallback', 'useDerivedValue', 'useAnimatedStyle', 'useAnimatedProps',
  'useAnimatedScrollHandler', 'runOnUI', 'scheduleOnUI',
]);
/** Por donde un worklet sí puede llegar a JS. */
const PUENTES = new Set(['runOnJS', 'scheduleOnRN']);
/** Lo que se importa de aquí ya es worklet (o lo maneja la propia librería). */
const LIBRERIAS_UI = /react-native-reanimated|react-native-worklets|@shopify\/react-native-skia|react-native-gesture-handler/;

function archivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) return archivos(p);
    return /\.(tsx?|jsx?)$/.test(f.name) && !f.name.endsWith('.d.ts') ? [p] : [];
  });
}

const esFactory = (n) =>
  n?.type === 'CallExpression' && n.callee.type === 'FunctionExpression' && /Factory$/.test(n.callee.id?.name ?? '');
const esFuncionLiteral = (n) => n?.type === 'ArrowFunctionExpression' || n?.type === 'FunctionExpression';

function nombreLlamada(c) {
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression' && !c.computed) return c.property.name;
  if (c.type === 'SequenceExpression') return nombreLlamada(c.expressions.at(-1));
  return null;
}

/** ¿Este valor es una función de JS (y no un worklet)? Sigue variables, temporales del compilador y useCallback. */
function esFuncionJS(scope, n, vistos = new Set()) {
  if (!n) return false;
  if (esFactory(n)) return false;
  if (esFuncionLiteral(n)) return true;
  if (n.type === 'CallExpression') {
    const nm = nombreLlamada(n.callee);
    if (nm === 'useCallback' || nm === 'useEffectEvent') return esFuncionJS(scope, n.arguments[0], vistos);
    return false;
  }
  if (n.type !== 'Identifier' || vistos.has(n.name)) return false;
  vistos.add(n.name);
  const b = scope.getBinding(n.name);
  if (!b) return false;
  if (b.path.node.type === 'FunctionDeclaration') return true;
  const inits = [
    b.path.node.init,
    ...b.constantViolations.map((v) => (v.node.type === 'AssignmentExpression' ? v.node.right : null)),
  ].filter(Boolean);
  return inits.some((i) => esFuncionJS(b.scope, i, vistos));
}

// 1. Compilar todo como en release.
const compilados = new Map();
for (const file of archivos(SRC)) {
  const fuente = fs.readFileSync(file, 'utf8');
  try {
    const { code } = babel.transformSync(fuente, { filename: file, cwd: ROOT, root: ROOT, envName: 'production', caller: CALLER });
    compilados.set(file, { code, ast: parser.parse(code, { sourceType: 'module', plugins: ['jsx'] }) });
  } catch (err) {
    console.error(`check:worklets: no compila ${path.relative(ROOT, file)}: ${err.message.split('\n')[0]}`);
    process.exit(1);
  }
}

// 2. Qué exporta cada módulo de la app que sea worklet.
const exportsWorklet = new Map();
for (const [file, { ast }] of compilados) {
  const set = new Set();
  traverse(ast, {
    VariableDeclarator(p) {
      if (esFactory(p.node.init) && p.parentPath.parentPath.parent.type === 'Program') set.add(p.node.id.name);
    },
  });
  exportsWorklet.set(file, set);
}
function resolverModulo(desde, req) {
  if (!req.startsWith('.')) return null;
  const base = path.resolve(path.dirname(desde), req);
  for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx']) if (compilados.has(base + ext)) return base + ext;
  return null;
}

// 3. Revisar.
const fallas = [];
for (const [file, { ast }] of compilados) {
  const rel = path.relative(ROOT, file);
  const requires = new Map();
  traverse(ast, {
    VariableDeclarator(p) {
      let i = p.node.init;
      if (i?.type === 'CallExpression' && i.callee.name?.startsWith('_interopRequire')) i = i.arguments[0];
      if (i?.type === 'CallExpression' && i.callee.name === 'require' && i.arguments[0]?.type === 'StringLiteral') {
        requires.set(p.node.id.name, i.arguments[0].value);
      }
    },
  });
  /** ¿Lo que captura el worklet es una función de JS? Devuelve una descripción, o null si no lo es. */
  const capturaJS = (scope, valor) => {
    if (valor.type === 'MemberExpression' && valor.object.type === 'Identifier') {
      const req = requires.get(valor.object.name);
      if (!req || LIBRERIAS_UI.test(req)) return null;
      const destino = resolverModulo(file, req);
      if (!destino) return null; // otra librería: no la juzgamos aquí
      const nombre = valor.property.name;
      if (exportsWorklet.get(destino)?.has(nombre)) return null;
      // Solo cuenta si lo exportado es una función (las constantes y objetos sí se pueden capturar).
      const ast2 = compilados.get(destino).ast;
      let esFn = false;
      traverse(ast2, {
        FunctionDeclaration(q) { if (q.node.id?.name === nombre && q.parent.type === 'Program') esFn = true; },
        VariableDeclarator(q) {
          if (q.node.id.name === nombre && q.parentPath.parentPath.parent.type === 'Program' && esFuncionLiteral(q.node.init)) esFn = true;
        },
      });
      return esFn ? `función importada de ${path.relative(ROOT, destino)}` : null;
    }
    if (valor.type === 'Identifier') {
      const b = scope.getBinding(valor.name);
      if (b?.kind === 'param') return null; // parámetros: se revisan donde se definen
      return esFuncionJS(scope, valor) ? 'función de JS' : null;
    }
    return esFuncionJS(scope, valor) ? 'función de JS' : null;
  };

  traverse(ast, {
    CallExpression(p) {
      // Regla 2: callbacks de animación sin convertir.
      const nm = nombreLlamada(p.node.callee);
      if (nm && API_ANIMACION.has(nm) && !p.findParent((q) => q.isFunctionExpression() && /Factory$/.test(q.node.id?.name ?? ''))) {
        for (const a of p.node.arguments) {
          if (esFuncionLiteral(a) || (a.type === 'Identifier' && esFuncionJS(p.scope, a))) {
            fallas.push(`${rel}: ${nm}() recibe una función que no es worklet`);
          }
        }
      }
      // Regla 1: worklets que usan funciones de JS capturadas sin puente.
      if (!esFactory(p.node)) return;
      const obj = p.node.arguments[0];
      if (obj?.type !== 'ObjectExpression') return;
      const fabrica = p.get('callee');
      const worklet = fabrica.node.id.name.replace(/Factory$/, '');
      for (const prop of obj.properties) {
        if (prop.type !== 'ObjectProperty') continue;
        const que = capturaJS(p.scope, prop.value);
        if (!que) continue;
        const b = fabrica.scope.getBinding(prop.key.name);
        const usoMalo = b?.referencePaths.find((r) => {
          const padre = r.parentPath;
          if (padre.isObjectProperty()) return false; // se la pasa a un worklet anidado: ahí se revisa
          if (padre.isCallExpression() && padre.node.arguments.includes(r.node) && PUENTES.has(nombreLlamada(padre.node.callee))) return false;
          return true;
        });
        if (usoMalo) fallas.push(`${rel}: el worklet ${worklet} usa «${prop.key.name}» (${que}) sin runOnJS/scheduleOnRN`);
      }
    },
  });
}

const unicas = [...new Set(fallas)];
if (unicas.length > 0) {
  console.error(`check:worklets: ${unicas.length} problema(s): en release esto truena con «Tried to synchronously call a Remote Function».\n`);
  for (const f of unicas) console.error(`  ✗ ${f}`);
  console.error(
    '\nUn worklet solo puede llamar a JS con runOnJS(fn)(…) o scheduleOnRN(fn, …). Si el culpable es una función que el' +
      ' React Compiler sacó del componente (`_temp…`), revisa enableFunctionOutlining en babel.config.js.',
  );
  process.exit(1);
}
console.log(`check:worklets: ${compilados.size} archivos compilados como release, ningún worklet llama a JS sin puente.`);
