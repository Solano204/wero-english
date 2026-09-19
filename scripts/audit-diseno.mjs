/**
 * Audita el código contra las reglas de DESIGN.md y regenera DESIGN-AUDIT.md.
 *
 *   npm run audit:diseno
 *
 * Es análisis estático de src/ y App.tsx: no ejecuta la app ni arregla nada.
 * Al final imprime cuántos hallazgos hay por regla y los compara con la
 * corrida anterior, para ver el efecto de cada arreglo.
 *
 * DESIGN-AUDIT.md se regenera entero, salvo lo que esté entre
 * <!-- PLAN:start --> y <!-- PLAN:end -->, que es el plan de arreglos
 * escrito a mano y se conserva tal cual.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SALIDA = path.join(ROOT, 'DESIGN-AUDIT.md');

// ── valores de los tokens (src/theme/tokens.ts). Si cambian, se actualizan aquí ──
const FS = { xs: 12, sm: 13, md: 16, lg: 18, xl: 22, xxl: 28, display: 34 };
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
const RA = { sm: 14, md: 20, lg: 28, xl: 36, pill: 999 };
const ESCALA = new Set([0, 4, 8, 12, 16, 24, 32, 48]);
const MAX_OPCIONES = 7;
/** Un mp3 de voz real pesa varios KB; por debajo de esto es un archivo roto. */
const MIN_BYTES_AUDIO = 1000;

const INTERACTIVO = /(btn|button|boton|chip|tab|pill|ficha|opcion|option|toggle|switch|check|close|cerrar|saltar|icono|icon|link|cta|filtro|selector|tecla|tile|pieza)/i;
const CUERPO = /(body|parrafo|cuerpo|desc|spanish|explic|porque|significado|traduccion|resumen|intro|gancho|idea|cuando|texto|frase|nota)/i;
const CONTENIDO = /(phrase|spanish|frase|traduc|titulo|title|nombre|palabra|gancho|pregunta|opcion|resumen|descripcion|\.es\b|\.en\b|\.a\b|\.b\b)/i;

/**
 * ACC-1, revisado leyendo el render de cada archivo. Tienen 2 o más
 * `primary`, pero nunca conviven en pantalla (vistas o estados excluyentes).
 */
const ACC1_NO_CONVIVEN = {
  'src/screens/extras/LecturaScreen.tsx': 'la vista de preguntas y la de lectura son excluyentes (`enPreguntas`)',
  'src/screens/games/CazalaScreen.tsx': '`checked ? Siguiente : Revisar`',
  'src/screens/games/GameEndScreen.tsx': '`nivel ? Nivel siguiente (primary) + Recoger (secondary) : Recoger (primary)`: nunca hay dos',
  'src/screens/entry/OnboardingScreen.tsx': 'un paso a la vez (`paso === N`); en el último, "Permitir y empezar" y "Entrar a la app" son excluyentes',
};
/** ACC-1 reales: la acción principal no es sólida, o hay varios sólidos a la vez. */
const ACC1_REALES = [
  { archivo: 'src/components/base/EmptyState.tsx', patron: /variant="secondary"/, motivo: (d) => `la acción del estado vacío es \`secondary\` (con borde); hay ${d.actionLabel} usos de \`actionLabel\`` },
  { archivo: 'src/screens/utility/DownloadsScreen.tsx', patron: /Ver anuncio y descargar/, motivo: () => 'la acción principal (descargar) es `secondary`, con borde' },
  { archivo: 'src/screens/extras/ErrorDetailScreen.tsx', patron: /Ver la frase completa/, motivo: () => 'única acción de la pantalla y es `secondary`' },
  { archivo: 'src/screens/extras/GramaticaTemaScreen.tsx', patron: /Escuchar todos/, motivo: () => '(discutible) única acción de la pantalla y es `ghost`' },
];

/** TIPO-2: textos de 12–13 px con nombre de cuerpo que se quedan así, revisados a mano. */
const TIPO2_SE_QUEDAN = {
  'src/components/base/Ads.tsx:fullNota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/entry/OnboardingScreen.tsx:nota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/entry/OnboardingScreen.tsx:chipTexto': 'etiqueta de una línea (metadato o chip)',
  'src/screens/extras/PracticeScreen.tsx:nota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/games/ColmenaScreen.tsx:nota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/games/CaidaScreen.tsx:finNota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/games/CaidaScreen.tsx:siguienteTexto': 'etiqueta de un botón de texto: lo que se toca es el contenedor',
  'src/screens/games/GameEndScreen.tsx:estrellasNota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/games/GameEndScreen.tsx:repasoNota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/games/DulcesScreen.tsx:pieNota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/games/DulcesScreen.tsx:metaFrase': 'etiqueta de una línea (metadato o chip)',
  'src/screens/games/DulcesScreen.tsx:seguirTexto': 'etiqueta de un botón de texto: lo que se toca es el contenedor',
  'src/screens/extras/LecturaScreen.tsx:leyendaTexto': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/extras/LecturasScreen.tsx:difTexto': 'etiqueta de una línea (metadato o chip)',
  'src/screens/utility/SettingsScreen.tsx:horaTexto': 'etiqueta de una línea (metadato o chip)',
  'src/screens/games/ParesScreen.tsx:saltarTexto': 'etiqueta de un botón de texto: lo que se toca es el contenedor',
};

/** TIPO-4: estilos de 28 px o más que no son títulos, revisados a mano. */
const TIPO4_NO_ES_TITULO = {
  'src/components/base/EmptyState.tsx:emoji': 'es un emoji, no texto',
  'src/components/base/Card.tsx:portadaVacia': 'inicial suelta de una portada pendiente (`textSobrePortada`), no un título',
  'src/components/card/SceneImage.tsx:inicial': 'inicial suelta de una imagen pendiente (`textSobrePortada`), no un título',
  'src/screens/games/GameEndScreen.tsx:estrellas': 'fila de glifos ★: el espaciado positivo los separa, con negativo se pisarían',
};

/** Colecciones grandes pintadas con `.map` dentro de un ScrollView, sin virtualizar. Revisado a mano. */
const LISTAS_SIN_VIRTUALIZAR = [
  { archivo: 'src/screens/extras/ErrorsScreen.tsx', patron: /lista\.map\(/, motivo: 'hasta 194 `Card` a la vez con el filtro "todos"; el arreglo se filtra y se ordena en cada render' },
  { archivo: 'src/screens/extras/PronunciationScreen.tsx', patron: /fonemas\.map\(\(f\)/, motivo: 'hasta 53 tarjetas de fonema (con imagen y botones de audio) a la vez' },
];

// ── utilidades ───────────────────────────────────────────────────────────
const rel =(p) => path.relative(ROOT, p).split(path.sep).join('/');
const esComentario = (l) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l);
const lineaDe = (src, i) => src.slice(0, i).split('\n').length;

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, o); }
    else if (/\.(ts|tsx)$/.test(e.name)) o.push(p);
  }
  return o;
}

function num(expr) {
  const t = expr.replace(/space\.(\w+)/g, (_, k) => SP[k] ?? 'NaN').replace(/font\.size\.(\w+)/g, (_, k) => FS[k] ?? 'NaN')
    .replace(/radius\.(\w+)/g, (_, k) => RA[k] ?? 'NaN').replace(/layout\.screenPad/g, '16').replace(/layout\.tapMin/g, '48')
    .replace(/iconoRedondo\.sm/g, '48').replace(/iconoRedondo\.md/g, '48').replace(/iconoRedondo\.lg/g, '52');
  if (!/^[\d\s.+\-*/()]+$/.test(t)) return null;
  try { const v = Function(`return (${t})`)(); return Number.isFinite(v) ? v : null; } catch { return null; }
}

/** Entradas de un StyleSheet.create({...}): { nombre, ini, lines }. */
function entradas(lines) {
  const out = []; let dentro = false;
  for (let i = 0; i < lines.length; i++) {
    if (/StyleSheet\.create\(\{/.test(lines[i])) { dentro = true; continue; }
    if (dentro && /^\}\);?/.test(lines[i])) { dentro = false; continue; }
    if (!dentro) continue;
    const m = lines[i].match(/^ {2}(\w+):\s*\{/);
    if (!m) continue;
    let depth = 0, j = i;
    for (; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
      if (depth <= 0) break;
    }
    out.push({ nombre: m[1], ini: i, lines: lines.slice(i, j + 1) });
    i = j;
  }
  return out;
}

function props(e) {
  const p = [];
  if (e.lines.length === 1) {
    const inner = e.lines[0].replace(/^ {2}\w+:\s*\{/, '').replace(/\},?\s*$/, '');
    for (const parte of inner.split(/,(?![^()]*\))/)) {
      const m = parte.match(/^\s*(\w+):\s*(.+?)\s*$/);
      if (m) p.push({ k: m[1], v: m[2], linea: e.ini + 1 });
    }
    return p;
  }
  e.lines.forEach((l, k) => {
    const m = l.match(/^\s*(\w+):\s*(.+?),?\s*$/);
    if (m && k > 0) p.push({ k: m[1], v: m[2], linea: e.ini + k + 1 });
  });
  return p;
}

/** Etiquetas JSX `<Tag ...>` con sus atributos completos (respeta llaves anidadas). */
function leeTags(src, tag) {
  const res = []; const re = new RegExp(`<${tag}(?=[\\s>/])`, 'g'); let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++; else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    res.push({ linea: lineaDe(src, m.index), texto: src.slice(m.index, i + 1) });
  }
  return res;
}

/** Valor de un atributo JSX `nombre={...}`, con las llaves bien emparejadas. */
function atributo(texto, nombre) {
  const i = texto.indexOf(`${nombre}={`);
  if (i < 0) return null;
  const ini = i + nombre.length + 1;
  let d = 0;
  for (let j = ini; j < texto.length; j++) {
    if (texto[j] === '{') d++;
    else if (texto[j] === '}' && --d === 0) return texto.slice(ini + 1, j);
  }
  return null;
}

function cierraParen(src, ini) {
  let d = 0;
  for (let i = ini; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')' && --d === 0) return i;
  }
  return -1;
}

const limpia = (s) => (s || '').replace(/\s+/g, ' ').trim();
const L = (a) => a.map((h) => `- \`${h.r}:${h.linea}\`${h.txt ? ' — ' + h.txt : ''}`).join('\n') || '- (ninguno)';

// ── contraste (WCAG) sobre los tokens de color ───────────────────────────
function contrastes(tokens) {
  const bloque = tokens.slice(tokens.indexOf('export const color'), tokens.indexOf('} as const;'));
  const hex = {}; let mundo = false;
  for (const l of bloque.split('\n')) {
    if (/world:\s*\{/.test(l)) { mundo = true; continue; }
    if (mundo && /^\s*\},/.test(l)) { mundo = false; continue; }
    const m = l.match(/^\s*(\w+):\s*'(#[0-9A-Fa-f]{6})'/);
    if (m) hex[(mundo ? 'world.' : '') + m[1]] = m[2];
  }
  const lum = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const superficies = ['bg', 'bgAlto', 'surface', 'surfaceAlt', 'surfaceHigh', 'contraste', 'correctFondo', 'wrongFondo'].filter((s) => hex[s]);
  const textos = ['text', 'textMuted', 'textFaint', 'accent', 'accentDeep', 'correct', 'correctDeep', 'wrong', 'wrongDeep', 'riskWarn', 'riskStrong', ...Object.keys(hex).filter((k) => k.startsWith('world.'))].filter((t) => hex[t]);
  const fallos = [];
  for (const t of textos) for (const s of superficies) { const v = cr(hex[t], hex[s]); if (v < 4.5) fallos.push({ t, s, v }); }
  const marca = Object.keys(hex).filter((k) => k.startsWith('world.')).length + (hex.contraste ? 1 : 0);
  return { fallos, marca };
}

// ── auditoría estática ───────────────────────────────────────────────────
function auditaEstatica(archivos) {
  const H = { gradiente: [], fuente: [], cuerpoMd: [], cuerpoSm: [], cuerpoDescartado: [], cuerpoSmResto: new Map(), titulo: [], tipo4Descartados: [], lineHeight: [], espacio: [], tactil: [], sombra: [], propio: [], emoji: [], glifo: [], botones: [] };
  for (const { r, src, lines } of archivos) {
    const enTema = r.startsWith('src/theme/');
    lines.forEach((l, i) => {
      if (esComentario(l)) return;
      const codigo = l.replace(/\s\/\/.*$/, '');
      const emojis = [...codigo.matchAll(/[\u{1F000}-\u{1FAFF}]|\p{Emoji_Presentation}|[☀-➿⭐⏩-⏺]️/gu)].map((m) => m[0]);
      if (emojis.length) H.emoji.push({ r, linea: i + 1, txt: [...new Set(emojis)].join(' ') });
      const glifos = [...codigo.matchAll(/[←-⇿■-◿☀-➿⬀-⯿⌀-⏿\u{1D100}-\u{1D1FF}›‹]/gu)].map((m) => m[0]).filter((g) => !emojis.includes(g));
      if (glifos.length) H.glifo.push({ r, linea: i + 1, txt: [...new Set(glifos)].join(' ') });
      if (/fontFamily/.test(l) && !/font\.family\./.test(l)) H.fuente.push({ r, linea: i + 1, txt: l.trim() });
      if (/<LinearGradient/.test(l)) H.gradiente.push({ r, linea: i + 1 });
    });
    if (!enTema && !r.startsWith('src/components/base/Button')) {
      const tags = leeTags(src, 'Button');
      if (tags.length) H.botones.push({ r, tags: tags.map((t) => ({ linea: t.linea, variant: limpia((t.texto.match(/variant=(\{[^}]*\}|"[^"]*")/) || [])[1]) || 'primary (por defecto)', label: limpia((t.texto.match(/label=(\{[^}]*\}|"[^"]*")/) || [])[1]).slice(0, 44) })) });
    }
    for (const e of entradas(lines)) evaluaEstilo(e, r, enTema, H);
  }
  return H;
}

function evaluaEstilo(e, r, enTema, H) {
  const p = props(e); const get = (k) => p.find((x) => x.k === k);
  const fsz = get('fontSize'); const tam = fsz ? num(fsz.v) : null;
  if (fsz && tam !== null && !enTema && tam < 16) {
    const item = { r, linea: fsz.linea, txt: `${e.nombre}: fontSize ${fsz.v.replace(/font\.size\./, '')} = ${tam}` };
    if (tam === 15) H.cuerpoMd.push(item);
    else if (CUERPO.test(e.nombre)) {
      const motivo = TIPO2_SE_QUEDAN[`${r}:${e.nombre}`];
      if (motivo) H.cuerpoDescartado.push({ ...item, txt: `${item.txt} — ${motivo}` });
      else H.cuerpoSm.push(item);
    }
    else H.cuerpoSmResto.set(r, (H.cuerpoSmResto.get(r) || 0) + 1);
  }
  if (fsz && tam !== null && tam >= 28) {
    const ls = get('letterSpacing'); const v = ls ? num(ls.v) : null;
    if (!(v !== null && v <= -0.0099 * tam && v >= -0.0201 * tam)) {
      const descarte = TIPO4_NO_ES_TITULO[`${r}:${e.nombre}`];
      if (descarte) H.tipo4Descartados.push({ r, linea: fsz.linea, txt: `${e.nombre}: ${descarte}` });
      else H.titulo.push({ r, linea: fsz.linea, txt: `${e.nombre}: ${tam} px, letterSpacing ${ls ? ls.v : 'sin definir'} (debe estar entre ${(-0.02 * tam).toFixed(2)} y ${(-0.01 * tam).toFixed(2)})` });
    }
  }
  const lh = get('lineHeight');
  if (lh && tam !== null && tam <= 18) {
    const m = lh.v.match(/\*\s*([\d.]+)/); const n = num(lh.v);
    const fac = m ? Number(m[1]) : (n !== null ? n / tam : null);
    if (fac !== null && (fac < 1.4 || fac > 1.6)) H.lineHeight.push({ r, linea: lh.linea, txt: `${e.nombre}: ${tam} px con lineHeight x${fac.toFixed(2)}` });
  }
  for (const x of p) {
    if (/^(padding|margin|gap|rowGap|columnGap)(Vertical|Horizontal|Top|Bottom|Left|Right|Start|End)?$/.test(x.k) && !enTema) {
      const v = num(x.v);
      // `padding: 1` es el filo de luz: una envoltura de 1 px con degradado que
      // hace de borde (Card, FeedbackBand, MuroDesbloqueo, barra de pestañas).
      // Es una técnica de dibujo, no un espaciado suelto, así que no cuenta.
      if (x.k === 'padding' && v === 1) continue;
      if (v !== null && !ESCALA.has(Math.abs(v))) H.espacio.push({ r, linea: x.linea, txt: `${e.nombre}: ${x.k}: ${x.v} = ${v}` });
    }
    if (x.k === 'shadowColor' && !/color\.shadow|'#000'|'#000000'|transparent/.test(x.v)) H.sombra.push({ r, linea: x.linea, txt: `${e.nombre}: shadowColor ${x.v}` });
    if (/^shadow(Opacity|Radius)$/.test(x.k) && !enTema) H.propio.push({ r, linea: x.linea, txt: `${e.nombre}: ${x.k} ${x.v} (sombra propia fuera de tokens)` });
  }
  const alto = get('minHeight') || get('height');
  // El `icon` de la barra de pestañas (28 dp) es solo el dibujo: lo que se toca
  // es la pestaña entera, de 68 dp de alto. No es un objetivo táctil chico.
  const esIconoDePestana = r === 'src/navigation/TabNavigator.tsx' && e.nombre === 'icon';
  if (alto && INTERACTIVO.test(e.nombre) && !enTema && !esIconoDePestana) {
    const v = num(alto.v);
    if (v !== null && v > 4 && v < 48) H.tactil.push({ r, linea: alto.linea, txt: `${e.nombre}: ${alto.k} ${alto.v} = ${v} dp` });
  }
}

/** Medidas de tokens y componentes que quedan bajo 48 dp (no son estilos de pantalla). */
function tokensTactiles(tokens, audioBtn) {
  const out = [];
  const icono = tokens.match(/export const iconoRedondo = \{([^}]*)\}/);
  if (icono) for (const m of icono[1].matchAll(/(\w+):\s*(\d+)/g)) if (Number(m[2]) < 48) out.push(`\`iconoRedondo.${m[1]}\` ${m[2]} dp (\`tokens.ts\`)`);
  // AudioButton: lo que se toca es `toque` (48 dp); la píldora visible (`sizes`) puede ser más chica.
  if (!/toque:\s*\{[^}]*minHeight:\s*layout\.tapMin/.test(audioBtn)) out.push(`\`AudioButton\` sin área táctil de 48 dp (\`toque\`)`);
  return out;
}

// ── auditoría de comportamiento ──────────────────────────────────────────
const esPantalla = (r) => /^src\/screens\/.*Screen\.tsx$/.test(r);

function primeraLinea(lines, re) {
  const i = lines.findIndex((l) => !esComentario(l) && re.test(l));
  return i < 0 ? null : i + 1;
}

/** a) ¿Cada pantalla que carga datos tiene estado de carga, vacío y error? */
function auditaEstados(archivos) {
  const RE = {
    carga: /\b(setLoading|setCargando|isLoading|loading|cargando|Repartiendo|Cargando)\b|<ActivityIndicator/,
    vacio: /<EmptyState|\.length === 0|\.length == 0|!\w+\.length\b/,
    error: /\.catch\(|\bcatch\s*[({]|setError|useState<[^>]*rror/,
  };
  const filas = [];
  for (const { r, lines, src } of archivos.filter((a) => esPantalla(a.r))) {
    // Carga datos = importa de la base y llama a alguna función de lectura.
    // Las pantallas que solo escriben (applyGameGrade…) no entran.
    if (!/from '@\/db\//.test(src) || !/\b(get|count|resumen|list|fetch)[A-Z]\w*\(/.test(src)) continue;
    const ev = Object.fromEntries(Object.entries(RE).map(([k, re]) => [k, primeraLinea(lines, re)]));
    filas.push({ r, ...ev });
  }
  return filas;
}

/** b) Texto cortado con numberOfLines={1} donde el contenido importa. */
function auditaTextoCortado(archivos) {
  const importa = [], otros = [];
  for (const { r, lines } of archivos) {
    lines.forEach((l, i) => {
      if (esComentario(l) || !/numberOfLines=\{1\}/.test(l)) return;
      const bloque = lines.slice(Math.max(0, i - 1), i + 4).join(' ');
      const expr = limpia((bloque.match(/numberOfLines=\{1\}[^>]*>\s*\{([^}]+)\}/) || [])[1]);
      const item = { r, linea: i + 1, txt: expr ? `\`{${expr.slice(0, 50)}}\`` : '' };
      (CONTENIDO.test(expr) ? importa : otros).push(item);
    });
  }
  return { importa, otros };
}

/** c) Rendimiento: listas, dependencias inestables, estado por intervalo. */
function auditaRendimiento(archivos) {
  const memo = new Set();
  for (const { src } of archivos) for (const m of src.matchAll(/(?:export\s+)?const (\w+)\s*=\s*memo\(/g)) memo.add(m[1]);
  const R = { listas: [], claves: [], deps: [], intervalos: [], estado: [] };
  for (const x of LISTAS_SIN_VIRTUALIZAR) {
    const a = archivos.find((f) => f.r === x.archivo);
    if (a) R.listas.push({ r: x.archivo, linea: primeraLinea(a.lines, x.patron) ?? 1, txt: `sin virtualizar: ${x.motivo}` });
  }
  for (const { r, src, lines } of archivos) {
    for (const tag of ['FlatList', 'SectionList']) {
      for (const t of leeTags(src, tag)) {
        const ke = atributo(t.texto, 'keyExtractor');
        if (ke === null) R.listas.push({ r, linea: t.linea, txt: `${tag} sin \`keyExtractor\`` });
        else if (/,\s*(i|idx|index)\s*\)/.test(ke)) R.listas.push({ r, linea: t.linea, txt: `${tag}: \`keyExtractor\` usa el índice` });
        if (/^\(\)\s*=>/.test((atributo(t.texto, 'ItemSeparatorComponent') || '').trim())) R.listas.push({ r, linea: t.linea, txt: `${tag}: \`ItemSeparatorComponent\` es una función nueva en cada render` });
        const desde = src.indexOf(t.texto);
        const item = (src.slice(src.indexOf('renderItem', desde), src.indexOf('renderItem', desde) + 400).match(/<(\w+)/) || [])[1];
        if (item && !memo.has(item) && /renderItem=\{/.test(t.texto)) R.listas.push({ r, linea: t.linea, txt: `${tag}: el ítem \`<${item}>\` no está envuelto en \`memo\`` });
      }
    }
    lines.forEach((l, i) => { if (!esComentario(l) && /\bkey=\{(i|idx|index)\}/.test(l)) R.claves.push({ r, linea: i + 1, txt: 'key por índice' }); });
    analizaDeps(r, src, lines, R.deps);
    analizaTicks(r, src, R.intervalos);
    const nEstado = (src.match(/\buseState\b/g) || []).length;
    if (esPantalla(r) && nEstado > 8) R.estado.push({ r, linea: 1, txt: `${nEstado} \`useState\` en la pantalla` });
  }
  return R;
}

const ESTABLE = /^(use[A-Z]\w*\(|loadContent\(|require\(|['"`\d]|true\b|false\b|null\b)/;
const INESTABLE = /^(\[|\{|new\s|async\b|function\b|(\([^)]*\)|\w+)\s*(:[^=]+)?=>)|\.(map|filter|sort|slice|concat|flatMap|reduce)\(|^Object\.|^Array\./;

/** Hooks con dependencias que se recrean en cada render (arreglos, objetos, funciones sin memo). */
function analizaDeps(r, src, lines, out) {
  for (const m of src.matchAll(/\b(useEffect|useLayoutEffect|useCallback|useMemo)\(/g)) {
    const ini = m.index + m[0].length - 1; const fin = cierraParen(src, ini);
    if (fin < 0) continue;
    const texto = src.slice(ini, fin + 1);
    const d = texto.match(/,\s*\[([^\[\]]*)\]\s*,?\s*\)$/);
    if (!d) {
      if (m[1] === 'useEffect' || m[1] === 'useLayoutEffect') out.push({ r, linea: lineaDe(src, m.index), txt: `${m[1]} sin arreglo de dependencias: corre en cada render` });
      continue;
    }
    const lineaDeps = lineaDe(src, ini + d.index);
    for (const id of d[1].split(',').map((s) => s.trim().split(/[.?]/)[0]).filter(Boolean)) {
      const decl = lines.findIndex((l) => new RegExp(`^ {2}const ${id}\\b\\s*(?::[^=]+)?=`).test(l));
      if (decl < 0) continue;
      const rhs = lines[decl].replace(/^ {2}const \w+\s*(?::[^=]+)?=\s*/, '').trim();
      if (ESTABLE.test(rhs) || !INESTABLE.test(rhs)) continue;
      out.push({ r, linea: lineaDeps, txt: `\`${m[1]}\` depende de \`${id}\`, que se recrea en cada render (declarado en :${decl + 1}: \`${rhs.slice(0, 48)}\`)` });
    }
  }
}

/** Estado que se actualiza por temporizador, cuadro o scroll: repinta el componente que lo tiene. */
function analizaTicks(r, src, out) {
  const alcance = esPantalla(r) ? '**toda la pantalla**' : 'un componente hoja';
  const aviso = (i, que) => out.push({ r, linea: lineaDe(src, i), txt: `${que} con \`setState\`: repinta ${alcance}` });
  for (const m of src.matchAll(/(setInterval|requestAnimationFrame)\(/g)) {
    const ini = m.index + m[0].length - 1;
    const cuerpo = src.slice(ini, cierraParen(src, ini));
    if (!/\bset[A-Z]\w*\(/.test(cuerpo)) continue;
    const ms = (cuerpo.match(/,\s*(\d+|[A-Z_]+)\s*$/) || [])[1];
    const valor = /^\d+$/.test(ms || '') ? ms : (src.match(new RegExp(`const ${ms}\\s*=\\s*(\\d+)`)) || [])[1];
    aviso(m.index, m[1] === 'setInterval' ? `\`setInterval\` cada ${valor ?? '?'} ms` : '`requestAnimationFrame`');
  }
  for (const m of src.matchAll(/onScroll=\{/g)) {
    if (/\bset[A-Z]\w*\(/.test(atributo(src.slice(m.index), 'onScroll') ?? '')) aviso(m.index, '`onScroll`');
  }
}

/** d) Audio: rutas de los JSON que no están en bundled.ts, y botones que las usan. */
function auditaAudio(archivos, bundledSrc) {
  const bundled = new Set([...bundledSrc.matchAll(/'([^']+)':\s*require/g)].map((m) => m[1]));
  const refs = new Set();
  const dataDir = path.join(ROOT, 'assets/data');
  const rec = (v) => {
    if (typeof v === 'string' && /^aud\/.+\.(mp3|m4a)$/.test(v)) refs.add(v);
    else if (Array.isArray(v)) v.forEach(rec);
    else if (v && typeof v === 'object') Object.values(v).forEach(rec);
  };
  for (const f of fs.readdirSync(dataDir).filter((n) => n.endsWith('.json'))) {
    try { rec(JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'))); } catch { /* json roto: lo cubre check:data */ }
  }
  const grupo = (p) => p.split('/').slice(0, p.split('/').length > 2 ? 2 : 1).join('/');
  const porGrupo = new Map();
  for (const p of refs) {
    const g = porGrupo.get(grupo(p)) ?? { total: 0, faltan: [] };
    g.total++; if (!bundled.has(p)) g.faltan.push(p);
    porGrupo.set(grupo(p), g);
  }
  const botones = archivos.map(({ r, src }) => ({ r, n: leeTags(src, 'AudioButton').length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  // Un mp3 empaquetado pero vacío (una derivación con ffmpeg que falló) no lo ve
  // isBundled: el botón se pinta activo y falla en silencio.
  const vacios = [...refs].filter((p) => {
    const f = path.join(ROOT, 'assets', p);
    return fs.existsSync(f) && fs.statSync(f).size < MIN_BYTES_AUDIO;
  });
  return { porGrupo, faltan: [...porGrupo.values()].reduce((s, g) => s + g.faltan.length, 0), total: refs.size, botones, vacios };
}

// ── ACC-1 ────────────────────────────────────────────────────────────────
function auditaAcc1(H, archivos) {
  const datos = { actionLabel: archivos.reduce((s, { src }) => s + (src.match(/actionLabel=/g) || []).length, 0) };
  const reales = ACC1_REALES.map((x) => {
    const a = archivos.find((f) => f.r === x.archivo);
    return { r: x.archivo, linea: a ? primeraLinea(a.lines, x.patron) ?? 1 : 1, txt: x.motivo(datos) };
  });
  const candidatos = H.botones.filter((b) => b.tags.filter((t) => /primary/.test(t.variant)).length > 1 && !ACC1_NO_CONVIVEN[b.r] && !ACC1_REALES.some((x) => x.archivo === b.r));
  return { reales, candidatos, descartados: Object.entries(ACC1_NO_CONVIVEN) };
}

// ── informe ──────────────────────────────────────────────────────────────
function leePrevio() {
  if (!fs.existsSync(SALIDA)) return { plan: null, conteos: {} };
  const t = fs.readFileSync(SALIDA, 'utf8');
  const plan = (t.match(/<!-- PLAN:start -->[\s\S]*?<!-- PLAN:end -->/) || [])[0] ?? null;
  const c = (t.match(/<!-- conteos: (\{.*?\}) -->/) || [])[1];
  return { plan, conteos: c ? JSON.parse(c) : {} };
}

function tablaEstados(filas) {
  const celda = (l) => (l ? `✓ \`:${l}\`` : '✗');
  const cuerpo = filas.map((f) => `| \`${f.r.replace('src/screens/', '')}\` | ${celda(f.carga)} | ${celda(f.vacio)} | ${celda(f.error)} |`).join('\n');
  return `| pantalla (archivo) | carga | vacío | error |\n|---|---|---|---|\n${cuerpo}`;
}

function conteoPorRegla(ctx) {
  const { H, C, E, T, R, A, acc1, modos, tokensBajos } = ctx;
  const sinE = (k) => E.filter((f) => !f[k]).length;
  return [
    ['COLOR-1', 'colores de marca de más (mundos + `contraste`)', C.marca],
    ['COLOR-3', 'colores sin escala 50–900', ctx.sinEscala ? 1 : 0],
    ['COLOR-4', 'pares texto/superficie bajo AA', C.fallos.length],
    ['TIPO-1', 'familias: fuente del sistema, `CharisSIL` sin cargar, `monospace`', ctx.tipo1],
    ['TIPO-2', 'cuerpo < 16 px (estilos de cuerpo en 15, 13 o 12, salvo los descartados a mano)', H.cuerpoMd.length + H.cuerpoSm.length],
    ['TIPO-2b', 'line-height del cuerpo fuera de 1.4–1.6', H.lineHeight.length],
    ['TIPO-4', 'títulos ≥ 28 px sin letterSpacing negativo', H.titulo.length],
    ['ESP-1', 'espaciado fuera de 4/8', H.espacio.length],
    ['ACC-1', 'acción principal no sólida o varios sólidos a la vez', acc1.reales.length + acc1.candidatos.length],
    ['ACC-3', `opciones visibles en Practicar (máximo recomendado ${MAX_OPCIONES})`, modos],
    ['MOV-1', 'áreas táctiles < 48 dp (estilos + tokens)', H.tactil.length + tokensBajos.length],
    ['IA-1', 'líneas con emojis', H.emoji.length],
    ['IA-1b', 'líneas con glifos de texto como íconos', H.glifo.length],
    ['IA-3', 'sombras de color o fuera de tokens', ctx.sombras],
    ['EST-carga', 'pantallas que cargan datos sin estado de carga', sinE('carga')],
    ['EST-vacio', 'pantallas que cargan datos sin estado vacío', sinE('vacio')],
    ['EST-error', 'pantallas que cargan datos sin estado de error', sinE('error')],
    ['TXT-1', 'texto de contenido cortado con `numberOfLines={1}`', T.importa.length],
    ['RND-1', 'listas sin `keyExtractor` estable, con ítem sin `memo` o con separador inline', R.listas.length],
    ['RND-2', 'hooks con dependencias que cambian en cada render', R.deps.length],
    ['RND-3', 'estado por intervalo, cuadro o scroll que repinta toda la pantalla', R.intervalos.filter((x) => x.txt.includes('pantalla')).length],
    ['AUD-1', 'audios de los JSON que no están en el bundle o están vacíos', A.faltan + A.vacios.length],
  ];
}

const SECCION_ESTATICA = (c) => `# Auditoría estática

## COLOR

**COLOR-1 · Máximo 3 colores de marca.** Hoy hay: acento cian \`accent\` (\`src/theme/tokens.ts:66\`), superficie \`contraste\` (\`:75\`) y una paleta de **8 colores de mundo** (\`:99-108\`) usada como color de categoría en tarjetas y chips. Aparte, \`riskStrong\` (\`:92\`), el rojo de lenguaje explícito.

**COLOR-2 · Degradados dentro de un mismo tono.** Los \`gradiente\` por mundo (\`tokens.ts:194-212\`) son de un solo tono. Para revisar: \`filoLuz\` (\`:165-169\`) mezcla blanco y cian, y \`FONDO\` (\`:149\`). Usos de \`<LinearGradient\`:
${L(c.H.gradiente)}

**COLOR-3 · Cada color con escala 50–900.** Ninguno la tiene: \`accent\` solo trae \`accent\`, \`accentSoft\` y \`accentDeep\` (\`tokens.ts:66-68\`); igual \`correct\`, \`wrong\` y los ocho de \`world\`.

**COLOR-4 · Contraste AA (4.5:1).** Pares texto/superficie que fallan (calculados de los tokens):
${c.C.fallos.map((f) => `- \`${f.t}\` sobre \`${f.s}\`: ${f.v.toFixed(2)}`).join('\n') || '- (ninguno)'}

\`text\` sobre \`accent\` da 1.47: usar siempre \`onAccent\`.

## TIPOGRAFÍA

**TIPO-1 · Máximo 2 familias; prohibidas Inter, Roboto, Arial y Space Grotesk como default.** Familias de \`font.family\` (\`tokens.ts\`), cargadas en \`App.tsx\` con \`useFonts\` (\`src/theme/fuentes.ts\`): Bricolage Grotesque (títulos), Instrument Sans (cuerpo) y Charis SIL (IPA). Un \`fontFamily\` que no salga de \`font.family\`, o un texto sin familia, cae a la fuente del sistema (en Android, **Roboto**). Ocurrencias fuera de \`font.family\`:
${L(c.H.fuente)}

**TIPO-2 · Cuerpo de 16 px mínimo.** El token de cuerpo \`font.size.md\` vale **16** (\`tokens.ts\`) y \`text.body\` y \`text.bodyMuted\` lo usan. Estilos de cuerpo o descripción por debajo de 16 px (${c.H.cuerpoMd.length + c.H.cuerpoSm.length}):
${L([...c.H.cuerpoMd, ...c.H.cuerpoSm])}

Se quedan en 12–13 px, revisados a mano (${c.H.cuerpoDescartado.length}):
${L(c.H.cuerpoDescartado)}

Otros \`fontSize\` < 16 por archivo (etiquetas y secundarios; revisar cuáles son cuerpo): ${[...c.H.cuerpoSmResto.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `\`${r}\` ${n}`).join(', ')}.

**TIPO-2b · Line-height del cuerpo entre 1.4 y 1.6** (texto de 18 px o menos):
${L(c.H.lineHeight)}

**TIPO-4 · Títulos ≥ 28 px con letterSpacing de −1% a −2%:**
${L(c.H.titulo)}
${c.H.tipo4Descartados.length ? '\nDescartados (28 px o más, pero no son títulos):\n' + L(c.H.tipo4Descartados) : ''}

## ESPACIADO

**ESP-1 · Escala 4/8 (4, 8, 12, 16, 24, 32, 48).** Los tokens \`space\` (\`tokens.ts:214-222\`) coinciden con la escala. Las violaciones son valores sueltos o sumas. No se cuenta \`padding: 1\`: es el filo de luz, una técnica de borde.
${L(c.H.espacio)}

## JERARQUÍA Y ACCIÓN

**ACC-1 · Una sola acción principal, botón sólido de alto contraste.** \`Button\` tiene 4 variantes: \`primary\` (cian sólido), \`secondary\` (con borde), \`ghost\` y \`danger\` (\`Button.tsx:143-158\`). Revisado leyendo cada render, **los hallazgos reales son:**
${L(c.acc1.reales)}
${c.acc1.candidatos.length ? '\nArchivos nuevos con 2 o más `primary` por verificar:\n' + L(c.acc1.candidatos.map((b) => ({ r: b.r, linea: b.tags[0].linea, txt: b.tags.map((t) => `:${t.linea} ${t.variant}`).join('; ') }))) : ''}

Descartados tras leer el render (tienen 2 o más \`primary\`, pero **nunca conviven en pantalla**):
${c.acc1.descartados.map(([r, m]) => `- \`${r}\` — ${m}`).join('\n')}

**ACC-3 · Menos opciones (Ley de Hick).** \`PracticeScreen\` (la pestaña de inicio) pinta **${c.modos} modos** como tarjetas de la misma jerarquía.

## MÓVIL

**MOV-1 · Área táctil mínima 48×48 dp.** Por debajo, en tokens y componentes:
${c.tokensBajos.map((t) => `- ${t}`).join('\n') || '- (ninguno)'}

Estilos interactivos con alto menor a 48 (verificar si llevan \`hitSlop\`):
${L(c.H.tactil)}

## ANTI-LOOK-IA

**IA-1 · Los emojis no son íconos de interfaz.** \`docs/DISENO.md\` (§ "Los emojis se quitaron") dice que salieron de toda la app; siguen en:
${L(c.H.emoji)}

**IA-1b · Íconos de un solo set y un solo grosor.** Glifos de texto (▶ ► ■ ✓ ✕ › → ☆…) usados como íconos, mezclados con emojis y con \`IconButton\`:
${L(c.H.glifo)}

**IA-3 · Sombras discretas y consistentes; ninguna de color.** El halo cian (\`glow\`) se eliminó: \`primary\` usa \`shadow.soft\` (negra) y la barra de pestañas usa \`shadow.card\`. \`shadow.card\` (opacidad 0.55, radio 20) y \`shadow.raised\` (0.7, radio 32) no son discretas. Sombras definidas fuera de los tokens:
${L(c.H.propio)}
${c.H.sombra.length ? '\nshadowColor que no es negro:\n' + L(c.H.sombra) : ''}

## Revisión manual (no se puede medir estáticamente)

- **TIPO-3** jerarquía con tamaño y peso, no solo color; **TIPO-5** no mezclar alineaciones en un bloque.
- **ESP-2** proximidad (lo que va junto, cerca; entre secciones, el doble).
- **ACC-2** una sola cosa destacada por pantalla: hoy conviven el botón principal cian, la superficie \`contraste\`, el filo de luz de cada tarjeta y el acento cian.
- **MOV-2** acciones frecuentes en la mitad inferior: en los juegos "Saltar" vive en el \`right\` del \`Header\` (arriba a la derecha).
- **MOV-3** barra inferior: flota (\`TabNavigator.tsx\`, estilo \`bar\`) sobre un \`BlurView\` con filo; tiene fondo propio, así que cumple, pero no va pegada al borde.
- **MOV-4** padding que empuja el contenido: revisar en dispositivo.
- **IA-2** tarjetas de distinto tamaño y peso: \`Card\` es una sola pieza con filo y sombra \`card\`.
`;

const SECCION_COMPORTAMIENTO = (c) => {
  const sinE = (k) => c.E.filter((f) => !f[k]).length;
  return `# Auditoría de comportamiento

## a) Estados: carga, vacío y error

Pantallas de \`src/screens/\` que leen de la base (\`@/db/\`). Cada celda apunta a la primera línea que evidencia el estado; ✗ es que no se detectó ninguno. La detección busca nombres de estado (\`loading\`, \`cargando\`, \`EmptyState\`, \`.length === 0\`, \`.catch\`, \`setError\`), así que un estado con otro nombre saldría ✗ y hay que confirmarlo.

${tablaEstados(c.E)}

Sin carga: ${sinE('carga')} de ${c.E.length} · sin vacío: ${sinE('vacio')} · sin error: ${sinE('error')}.

## b) Texto cortado

\`numberOfLines={1}\` en texto cuyo contenido importa (frases, traducciones, títulos, nombres). Se corta con "…" y el usuario no puede leer el resto:
${L(c.T.importa)}

Otros ${c.T.otros.length} \`numberOfLines={1}\` en etiquetas, contadores y similares no se listan.

## c) Rendimiento

**Listas:** \`FlatList\` o \`SectionList\` sin \`keyExtractor\`, con clave por índice, con el ítem sin \`memo\` o con el separador creado en cada render, y colecciones grandes pintadas con \`.map\` dentro de un \`ScrollView\`:
${L(c.R.listas)}

**Dependencias que cambian en cada render** (el efecto o el callback se vuelve a disparar sin necesidad, como pasaba con \`grupos\` en \`ContractionsScreen\`):
${L(c.R.deps)}

**Estado que se actualiza por intervalo, cuadro o scroll** (\`setInterval\`, \`requestAnimationFrame\`, \`onScroll\` con \`setState\`; solo el de una pantalla cuenta como hallazgo, el de un componente hoja es informativo):
${L(c.R.intervalos)}

**Solo informativo (no cuenta):** claves por índice en listas estáticas, que solo importan si la lista se reordena o se filtra:
${L(c.R.claves)}

Pantallas con más de 8 \`useState\` (cualquier cambio repinta la pantalla; no es un bug por sí solo, pero es donde mirar si hay tirones): ${c.R.estado.map((x) => `\`${x.r.replace('src/screens/', '')}\` ${x.txt.split(' ')[0]}`).join(', ') || 'ninguna'}.

## d) Audio

Los botones de audio no desaparecen cuando falta el archivo: \`AudioButton\` se pinta **apagado** (opacidad 0.4, deshabilitado) si la ruta no está empaquetada ni descargada (\`hayAudio\`, \`AudioButton.tsx\`). Rutas de audio que los JSON de \`assets/data/\` piden y **no están en \`bundled.ts\`** (${c.A.faltan} de ${c.A.total}):

| grupo | pedidas | sin empaquetar |
|---|---|---|
${[...c.A.porGrupo.entries()].sort((a, b) => b[1].faltan.length - a[1].faltan.length).map(([g, v]) => `| \`${g}\` | ${v.total} | ${v.faltan.length}${v.faltan.length ? ` (ej. \`${v.faltan[0]}\`)` : ''} |`).join('\n')}

**Audios vacíos** (empaquetados, pero de menos de ${MIN_BYTES_AUDIO} bytes: \`isBundled\` dice que existen, así que su botón se pinta **activo** y falla en silencio):
${c.A.vacios.map((p) => `- \`assets/${p}\``).join('\n') || '- (ninguno)'}

Archivos que pintan \`<AudioButton>\`: ${c.A.botones.map((b) => `\`${b.r.replace('src/', '')}\` ${b.n}`).join(', ')}.

## Notas

- \`padding: 1\` (Card, FeedbackBand, MuroDesbloqueo, TabNavigator) es la técnica del filo de luz y no se cuenta en ESP-1.
- \`impeccable detect src\` devolvió 0 hallazgos; sus patrones son de HTML y CSS, así que ese 0 no dice nada de esta app.
- Los conteos salen de análisis estático: resuelve expresiones con los tokens \`space\` y \`font.size\`, no valores calculados en ejecución.
`;
};

function main() {
  const archivos = walk(path.join(ROOT, 'src')).concat([path.join(ROOT, 'App.tsx')]).map((f) => {
    const src = fs.readFileSync(f, 'utf8');
    return { r: rel(f), src, lines: src.split('\n') };
  });
  const leer = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const tokens = leer('src/theme/tokens.ts');
  const H = auditaEstatica(archivos);
  const practicar = archivos.find((a) => a.r === 'src/screens/extras/PracticeScreen.tsx');
  const coloreadas = (tokens.match(/shadowColor:\s*'#[0-9A-Fa-f]{6}'/g) || []).filter((s) => !/#000000/i.test(s)).length;
  const ctx = {
    H, C: contrastes(tokens), E: auditaEstados(archivos), T: auditaTextoCortado(archivos), R: auditaRendimiento(archivos),
    A: auditaAudio(archivos, leer('src/assets/bundled.ts')), acc1: auditaAcc1(H, archivos),
    modos: leeTags(practicar.src, 'Modo').length,
    tokensBajos: tokensTactiles(tokens, leer('src/components/card/AudioButton.tsx')),
    sinEscala: !/accent(50|100|200|300|400|500|600|700|800|900)\b/.test(tokens),
    tipo1: (/fontFamily/.test(leer('src/theme/typography.ts')) ? 0 : 1) + (/ipa:\s*'CharisSIL'/.test(tokens) && !archivos.some((a) => /useFonts\(/.test(a.src)) ? 1 : 0) + H.fuente.length,
    sombras: coloreadas + H.sombra.length + H.propio.length,
  };
  const previo = leePrevio();
  const filas = conteoPorRegla(ctx);
  const actuales = Object.fromEntries(filas.map(([k, , n]) => [k, n]));
  const plan = previo.plan ?? '<!-- PLAN:start -->\n## Top 10\n\n(pendiente)\n<!-- PLAN:end -->';
  const encabezado = `# Auditoría de diseño

Qué reglas de \`DESIGN.md\` incumple hoy el código y cómo se comporta en pantallas, texto, rendimiento y audio. **No se corrigió nada.**
Se regenera con \`npm run audit:diseno\` (análisis estático de ${archivos.length} archivos de \`src/\` y \`App.tsx\`). Las reglas que dependen de juicio visual van en "Revisión manual".

${plan}

## Conteo por regla

| Regla | Qué mide | Hallazgos |
|---|---|---|
${filas.map(([k, q, n]) => `| ${k} | ${q} | ${n} |`).join('\n')}

`;
  fs.writeFileSync(SALIDA, `${encabezado}${SECCION_ESTATICA(ctx)}\n${SECCION_COMPORTAMIENTO(ctx)}\n<!-- conteos: ${JSON.stringify(actuales)} -->\n`);

  console.log('\nregla       antes → ahora    qué mide');
  for (const [k, q, n] of filas) {
    const antes = previo.conteos[k];
    const delta = antes === undefined ? '(nueva)' : antes === n ? '' : `${n < antes ? '↓' : '↑'}${Math.abs(n - antes)}`;
    console.log(`${k.padEnd(11)} ${String(antes ?? '-').padStart(5)} → ${String(n).padEnd(5)} ${delta.padEnd(8)} ${q}`);
  }
  console.log(`\nEscrito ${path.relative(ROOT, SALIDA)}`);
}

main();
