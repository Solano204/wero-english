/**
 * Falla si aparece un color literal fuera de src/theme/.
 *
 *   npm run check:color
 *
 * Busca hex (#rgb, #rgba, #rrggbb, #rrggbbaa) y rgb( / rgba( en src/ y App.tsx,
 * sin contar comentarios. Todo color sale de src/theme/tokens.ts.
 * Sale con código 1 y lista archivo:línea si encuentra alguno.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TEMA = path.join(ROOT, 'src', 'theme');
const COLOR = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?!\w)|\brgba?\s*\(/;
/** Un color escrito a mano dentro de un shader de Skia: half4(0.27, 0.85, 1.0, 1.0). El color entra por uniform, desde tokens. */
const COLOR_SKSL = /\b(?:half4|float4|vec4)\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\)/;
/** COLOR-2: los tres pasos del degradado `senal` no se separan más de esto en tono (grados). */
const MAX_DIF_TONO = 8;

const esColor = (l) => COLOR.test(l) || COLOR_SKSL.test(l);

/**
 * COLOR-3: `riskStrong` (el único rojo) y el tono `strong` del Badge son solo para lenguaje explícito. Un fallo, un
 * error o una gravedad van en `wrong` (ámbar, nunca rojo). Solo estos archivos pueden usarlos.
 */
const EXPLICITO = new Set([
  // Define el tono `strong` y RiskBadge («Solo con amigos»).
  'src/components/base/Badge.tsx',
  // El paso explícito de la escala de registro.
  'src/components/detalle/EscalaRegistro.tsx',
  // El aviso «Fuerte» de una frase con vulgaridad 2.
  'src/components/mazo/CartaFrase.tsx',
  'src/components/phrasal/DetalleForma.tsx',
  // Solo __DEV__: el muestrario de paletas mide el contraste de `riskStrong`, no lo usa.
  'src/screens/utility/MuestrarioScreen.tsx',
]);
const ROJO = /\briskStrong(?:Soft)?\b|['"]strong['"]/;
const rojoFueraDeLugar = (rel, src) => (EXPLICITO.has(rel) ? [] : sinComentarios(src).split('\n').flatMap((l, i) => (ROJO.test(l) ? [i + 1] : [])));

/** Tono (0 a 360) de un #rrggbb. */
export function tono(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Diferencia circular entre dos tonos. */
const difTono = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** COLOR-2: `senal` sale solo de tokens de `color` y sus pasos son del mismo tono. Devuelve los errores. */
function revisaSenal() {
  const tokens = fs.readFileSync(path.join(TEMA, 'tokens.ts'), 'utf8');
  const decl = tokens.match(/export const senal[^=]*=\s*\[([^\]]+)\]/);
  if (!decl) return ['senal no está definido en src/theme/tokens.ts'];
  const pasos = decl[1].split(',').map((p) => p.trim()).filter(Boolean);
  const tonos = [];
  for (const p of pasos) {
    const nombre = (p.match(/^color\.(\w+)$/) || [])[1];
    const hex = nombre && (tokens.match(new RegExp(`\\b${nombre}:\\s*'(#[0-9A-Fa-f]{6})'`)) || [])[1];
    if (!hex) return [`senal: \`${p}\` no es un token de color con hex`];
    tonos.push(tono(hex));
  }
  const dif = Math.max(...tonos.flatMap((a) => tonos.map((b) => difTono(a, b))));
  console.log(`senal: ${pasos.length} pasos, separación de tono ${dif.toFixed(1)}° (máximo ${MAX_DIF_TONO}°)`);
  return dif > MAX_DIF_TONO ? [`senal: los pasos se separan ${dif.toFixed(1)}° de tono (máximo ${MAX_DIF_TONO}°): COLOR-2`] : [];
}

/** Quita comentarios de línea y de bloque sin tocar las cadenas ni el número de líneas. */
export function sinComentarios(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      const fin = src.indexOf('*/', i + 2);
      const bloque = src.slice(i, fin < 0 ? src.length : fin + 2);
      out += bloque.replace(/[^\n]/g, '');
      i += bloque.length;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function autoprueba() {
  const hallazgos = (s) => sinComentarios(s).split('\n').filter(esColor).length;
  const casos = [
    ["const a = '#FFF';", 1],
    ["const a = '#ffffff80';", 1],
    ['const a = `rgba(0, 0, 0, 0.5)`;', 1],
    ['const a = rgb(1,2,3);', 1],
    ["// color: '#fff'", 0],
    ['/* rgba(0,0,0,1) */ const a = 1;', 0],
    ['/**\n * usa #000000\n */\nconst a = 1;', 0],
    ["{/* '#fff' */}", 0],
    ["const a = 1; // '#fff'", 0],
    ["const n = 'Nivel #1'; const a = color.bg;", 0],
    ["const u = 'https://x.com/#abc';", 1],
    ['return half4(0.27, 0.85, 1.0, 1.0);', 1],
    ['return half4(half3(n), 1.0);', 0],
    ['return half4(half3(tinte.rgb * v), half(v));', 0],
  ];
  for (const [src, esperado] of casos) {
    const real = hallazgos(src);
    if (real !== esperado) throw new Error(`autoprueba: ${JSON.stringify(src)} dio ${real}, esperaba ${esperado}`);
  }
  console.log(`autoprueba: ${casos.length} casos ok`);
  const rojo = [
    ['src/screens/x.tsx', 'const c = color.riskStrong;', 1],
    ['src/screens/x.tsx', 'const c = color.riskStrongSoft;', 1],
    ['src/screens/x.tsx', '<Badge label="Cambia" tone="strong" />', 1],
    ['src/screens/x.tsx', "tone: 'strong',", 1],
    ['src/screens/x.tsx', '// color.riskStrong', 0],
    ['src/screens/x.tsx', '/* tone="strong" */ const a = 1;', 0],
    ['src/screens/x.tsx', 'fontFamily: font.family.bodyStrong,', 0],
    ['src/components/detalle/EscalaRegistro.tsx', 'const c = color.riskStrong;', 0],
    ['src/components/base/Badge.tsx', "tone={v === 2 ? 'strong' : 'warn'}", 0],
  ];
  for (const [rel, src, esperado] of rojo) {
    const real = rojoFueraDeLugar(rel, src).length;
    if (real !== esperado) throw new Error(`autoprueba COLOR-3: ${rel} ${JSON.stringify(src)} dio ${real}, esperaba ${esperado}`);
  }
  console.log(`autoprueba COLOR-3: ${rojo.length} casos ok`);
  const hue = Math.round(tono('#45D9FF'));
  if (hue < 190 || hue > 192) throw new Error(`autoprueba: el tono de #45D9FF dio ${hue}, esperaba 191`);
  if (difTono(350, 10) !== 20) throw new Error('autoprueba: la diferencia de tono no es circular');
}

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p !== TEMA) archivos(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

if (process.argv.includes('--test')) {
  autoprueba();
} else {
  const lista = archivos(path.join(ROOT, 'src')).concat(path.join(ROOT, 'App.tsx'));
  const hallazgos = [];
  const rojos = [];
  for (const f of lista) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    const fuente = fs.readFileSync(f, 'utf8');
    for (const n of rojoFueraDeLugar(rel, fuente)) rojos.push(`${rel}:${n}  ${fuente.split('\n')[n - 1].trim().slice(0, 90)}`);
    const original = fuente.split('\n');
    sinComentarios(original.join('\n'))
      .split('\n')
      .forEach((l, i) => {
        if (esColor(l)) hallazgos.push(`${path.relative(ROOT, f).split(path.sep).join('/')}:${i + 1}  ${original[i].trim().slice(0, 90)}`);
      });
  }
  console.log(`archivos revisados: ${lista.length}`);
  console.log(`colores fuera de src/theme/: ${hallazgos.length}`);
  for (const h of hallazgos) console.log(`  ${h}`);
  console.log(`rojo fuera de lenguaje explícito (COLOR-3): ${rojos.length}`);
  for (const r of rojos) console.log(`  ${r}`);
  const errores = revisaSenal();
  for (const e of errores) console.log(`  ${e}`);
  if (hallazgos.length || rojos.length || errores.length) process.exit(1);
}
