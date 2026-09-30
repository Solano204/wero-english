/**
 * Audita el código contra las reglas de DESIGN.md y regenera DESIGN-AUDIT.md.
 *
 *   npm run audit:diseno
 *
 * Es análisis estático de src/: no ejecuta la app ni arregla nada.
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
  'src/features/lecturas/screens/LecturaScreen.tsx': 'la vista de preguntas y la de lectura son excluyentes (`enPreguntas`)',
  'src/features/juegos/cazala/components/PieCaza.tsx': '`revisada ? Siguiente : Revisar`: el pie muestra uno u otro, nunca los dos',
  'src/features/juegos/fin/screens/GameEndScreen.tsx': '`nivel ? Nivel siguiente (primary) + Recoger (secondary) : Recoger (primary)`: nunca hay dos',
  'src/screens/utility/DownloadsScreen.tsx': 'lista de 16 packs con la misma acción "descargar": ninguna es la principal y 16 `primary` romperían "una sola acción sólida"; se queda `secondary`',
  'src/screens/entry/OnboardingScreen.tsx': 'un paso a la vez (`paso === N`); en el último, "Permitir y empezar" y "Entrar a la app" son excluyentes',
  'src/features/estudio/components/FinDelDia.tsx': '`quedan ? Seguir repasando : sinNuevas ? Frases sueltas : Aprender frases nuevas`: un solo `primary` a la vez; Jugar es `secondary` y Volver `ghost`',
  'src/screens/entry/AuthScreen.tsx': 'tres vistas excluyentes (vincular tu avance, usuario y contraseña, inicio), cada una con un solo `primary`; en el inicio la acción principal es «Continuar con Google» (`BotonGoogle`, con la marca de Google) y lo demás es `secondary`/`ghost`',
};

/**
 * TIPO-1: `fontFamily` fuera de `font.family` a propósito. El botón de Google
 * sigue sus lineamientos de marca: Roboto Medium, la fuente del sistema en Android.
 */
const TIPO1_EXCEPCIONES = {
  'src/components/entrada/BotonGoogle.tsx': 'los lineamientos de marca de «Sign in with Google» piden Roboto Medium',
};
/** ACC-1 reales: la acción principal no es sólida, o hay varios sólidos a la vez. */
const ACC1_REALES = [
];

/** TIPO-2: textos de 12–13 px con nombre de cuerpo que se quedan así, revisados a mano. */
const TIPO2_SE_QUEDAN = {
  'src/shared/ui/Ads.tsx:fullNota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/entry/AuthScreen.tsx:legalTexto': 'nota al pie o leyenda: «Al continuar aceptas los Términos y el Aviso de privacidad», una línea bajo los botones',
  'src/components/entrada/BotonGoogle.tsx:texto': 'la etiqueta del botón «Continuar con Google» va en 14 como piden los lineamientos de marca de Google',
  'src/screens/entry/OnboardingScreen.tsx:nota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/screens/entry/OnboardingScreen.tsx:chipTexto': 'etiqueta de una línea (metadato o chip)',
  'src/features/practicar/screens/PracticeScreen.tsx:nota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/features/juegos/colmena/screens/ColmenaScreen.tsx:nota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/features/juegos/caida/components/FinCaida.tsx:nota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/features/juegos/fin/screens/GameEndScreen.tsx:estrellasNota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/features/juegos/fin/screens/GameEndScreen.tsx:repasoNota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/features/juegos/dulces/components/PieDulces.tsx:nota': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/features/lecturas/screens/LecturaScreen.tsx:leyendaTexto': 'nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia',
  'src/features/lecturas/screens/LecturasScreen.tsx:difTexto': 'etiqueta de una línea (metadato o chip)',
  'src/screens/utility/SettingsScreen.tsx:horaTexto': 'etiqueta de una línea (metadato o chip)',
  'src/features/juegos/pares/screens/ParesScreen.tsx:saltarTexto': 'etiqueta de un botón de texto: lo que se toca es el contenedor',
  'src/features/vocabulario/components/EntryRow.tsx:verTexto': 'etiqueta de un botón de texto: lo que se toca es el contenedor',
  'src/features/progreso/components/Espectrograma.tsx:etiquetaTexto': 'etiqueta flotante de una línea con el dato del día que se toca: metadato, no lo que se estudia',
  'src/features/progreso/components/Espectrograma.tsx:hoyTexto': 'etiqueta de una línea (metadato o chip)',
  'src/features/progreso/components/Espectrograma.tsx:listaTexto': 'texto alternativo de la gráfica: una línea por día, información secundaria',
  'src/features/gramatica/components/BloqueGramatica.tsx:resumen': 'una línea de lo que reúne el bloque, como `FilaModo.corta` de Practicar: apoya al título, no es lo que se estudia',
  'src/features/gramatica/components/RenglonTema.tsx:gancho': 'una o dos líneas que apoyan al título del renglón, como `FilaModo.corta` de Practicar; el gancho del tema se lee en 16 px en su pantalla',
};

/** TIPO-4: estilos de 28 px o más que no son títulos, revisados a mano. */
const TIPO4_NO_ES_TITULO = {
  'src/shared/ui/Card.tsx:portadaVacia': 'inicial suelta de una portada pendiente (`textSobrePortada`), no un título',
  'src/shared/ui/SceneImage.tsx:inicial': 'inicial suelta de una imagen pendiente (`textSobrePortada`), no un título',
};

/** Colecciones grandes pintadas con `.map` dentro de un ScrollView, sin virtualizar. Revisado a mano. */
const LISTAS_SIN_VIRTUALIZAR = [
  { archivo: 'src/features/errores/screens/ErrorsScreen.tsx', patron: /lista\.map\(/, motivo: 'hasta 194 `Card` a la vez con el filtro "todos"; el arreglo se filtra y se ordena en cada render' },
  { archivo: 'src/features/sonidos/screens/PronunciationScreen.tsx', patron: /fonemas\.map\(\(f\)/, motivo: 'hasta 53 tarjetas de fonema (con imagen y botones de audio) a la vez' },
];

/** COLOR-1: usos de un color de mundo como relleno que sí se aceptan, con su motivo. */
const COLOR1_EXCEPCIONES = [];

/** COLOR-3: los colores de marca que necesitan escala 50–900. */
const COLORES_DE_MARCA = ['accent', 'contraste', 'neutral'];
const PASOS_ESCALA = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

/** MOT-1: curvas lineales válidas. Son relojes de la ronda, no animación de interfaz. */
const MOT1_EXCEPCIONES = [
  { archivo: 'src/shared/ui/RoundTimer.tsx', patron: /Easing\.linear/, motivo: 'reloj de la ronda: la barra baja a ritmo constante durante los segundos que dura la ronda' },
  { archivo: 'src/features/juegos/caida/screens/CaidaScreen.tsx', patron: /Easing\.linear/, motivo: 'reloj de la ronda: la ficha cae a velocidad constante y su duración es la de la ronda' },
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
  const textos = ['text', 'textMuted', 'textFaint', 'star', 'accent', 'accentDeep', 'correct', 'correctDeep', 'wrong', 'wrongDeep', 'riskWarn', 'riskStrong', ...Object.keys(hex).filter((k) => k.startsWith('world.'))].filter((t) => hex[t]);
  const fallos = [];
  for (const t of textos) for (const s of superficies) { const v = cr(hex[t], hex[s]); if (v < 4.5) fallos.push({ t, s, v }); }
  // COLOR-1: un color de mundo solo cuenta como de marca si tiñe fondos grandes; el
  // primero son las portadas (`gradiente`), con cualquier clave que no sea `neutro`.
  const bloqueGrad = tokens.slice(tokens.indexOf('export const gradiente'));
  const gradTint = [...bloqueGrad.slice(0, bloqueGrad.indexOf('};')).matchAll(/^\s+(\w+):\s*\[/gm)].map((m) => m[1]).filter((k) => k !== 'neutro');
  return { fallos, marca: gradTint.length, gradTint };
}

// ── auditoría estática ───────────────────────────────────────────────────
function auditaEstatica(archivos) {
  const H = { espacioExento: [], gradiente: [], fuente: [], cuerpoMd: [], cuerpoSm: [], cuerpoDescartado: [], cuerpoSmResto: new Map(), titulo: [], tipo4Descartados: [], lineHeight: [], espacio: [], tactil: [], sombra: [], propio: [], emoji: [], glifo: [], botones: [] };
  for (const { r, src, lines } of archivos) {
    const enTema = r.startsWith('src/theme/');
    lines.forEach((l, i) => {
      if (esComentario(l)) return;
      const codigo = l.replace(/\s\/\/.*$/, '');
      const emojis = [...codigo.matchAll(/[\u{1F000}-\u{1FAFF}]|\p{Emoji_Presentation}|[☀-➿⭐⏩-⏺]️/gu)].map((m) => m[0]);
      if (emojis.length) H.emoji.push({ r, linea: i + 1, txt: [...new Set(emojis)].join(' ') });
      const glifos = [...codigo.matchAll(/[←-⇿■-◿☀-➿⬀-⯿⌀-⏿\u{1D100}-\u{1D1FF}›‹]/gu)].map((m) => m[0]).filter((g) => !emojis.includes(g));
      if (glifos.length) H.glifo.push({ r, linea: i + 1, txt: [...new Set(glifos)].join(' ') });
      if (/fontFamily/.test(l) && !/font\.family\./.test(l) && !TIPO1_EXCEPCIONES[r]) H.fuente.push({ r, linea: i + 1, txt: l.trim() });
      if (/<LinearGradient/.test(l)) H.gradiente.push({ r, linea: i + 1 });
    });
    if (!enTema && !r.startsWith('src/shared/ui/Button')) {
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
      if (x.k === 'padding' && v === 1) { H.espacioExento.push({ r, linea: x.linea, txt: `${e.nombre}: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)` }); continue; }
      // Un margen negativo de hasta 2 px compensa el grosor de un borde: tampoco es espaciado.
      if (/^margin/.test(x.k) && v !== null && v < 0 && Math.abs(v) <= 2) { H.espacioExento.push({ r, linea: x.linea, txt: `${e.nombre}: ${x.k} ${v}, compensa un borde de 1 a 2 px` }); continue; }
      if (v !== null && !ESCALA.has(Math.abs(v))) H.espacio.push({ r, linea: x.linea, txt: `${e.nombre}: ${x.k}: ${x.v} = ${v}` });
    }
    if (x.k === 'shadowColor' && !/color\.shadow|'#000'|'#000000'|transparent/.test(x.v)) H.sombra.push({ r, linea: x.linea, txt: `${e.nombre}: shadowColor ${x.v}` });
    if (/^shadow(Opacity|Radius)$/.test(x.k) && !enTema) H.propio.push({ r, linea: x.linea, txt: `${e.nombre}: ${x.k} ${x.v} (sombra propia fuera de tokens)` });
  }
  const alto = get('minHeight') || get('height');
  // El `icon` de la barra de pestañas (28 dp) es solo el dibujo: lo que se toca
  // es la pestaña entera, de 68 dp de alto. No es un objetivo táctil chico.
  const esIconoDePestana = r === 'src/app/navegacion/TabNavigator.tsx' && e.nombre === 'icon';
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
const esPantalla = (r) => /^src\/(.+\/)?screens\/.*Screen\.tsx$/.test(r) || r === 'src/app/arranque/BootScreen.tsx';
/** Nombre corto de una pantalla o archivo para las tablas del informe. */
const corto = (r) => r.replace(/^src\/(screens|features)\//, '');
/** Los efectos de la señal: `shared/ui/fx/` y los que viven con la única pantalla que los usa. */
const FX_EN_FEATURES = new Set([
  'src/features/practicar/components/BotonSenal.tsx',
  'src/features/practicar/components/FondoAurora.tsx',
  'src/features/practicar/components/MedidorVU.tsx',
  'src/features/practicar/components/OndaSenal.tsx',
  'src/features/practicar/components/PortadaJuego.tsx',
  'src/features/practicar/components/TarjetaTilt.tsx',
  'src/features/progreso/components/Espectrograma.tsx',
  'src/features/progreso/components/MedidorSenal.tsx',
  'src/features/oido/components/AnilloRadio.tsx',
  'src/features/oido/hooks/useBolsillo.ts',
  'src/features/estudio/components/HojaVeredicto.tsx',
  'src/features/estudio/components/ChipMarcador.tsx',
  'src/app/navegacion/PildoraLiquida.tsx',
  'src/app/navegacion/TransicionHoy.tsx',
  'src/shared/hooks/useVisibilidad.ts',
]);
const esFx = (r) => r.startsWith('src/components/fx/') || r.startsWith('src/shared/ui/fx/') || FX_EN_FEATURES.has(r);

function primeraLinea(lines, re) {
  const i = lines.findIndex((l) => !esComentario(l) && re.test(l));
  return i < 0 ? null : i + 1;
}

/** a) ¿Cada pantalla que carga datos tiene estado de carga, vacío y error? */
function auditaEstados(archivos) {
  const RE = {
    carga: /\b(setLoading|setCargando|isLoading|loading|cargando|Repartiendo|Cargando)\b|<ActivityIndicator|\buseCarga\(|<Carga\b/,
    vacio: /<EmptyState|\.length === 0|\.length == 0|!\w+\.length\b/,
    error: /\.catch\(|\bcatch\s*[({]|setError|useState<[^>]*rror|<Carga\b|<ErrorCarga|estado === 'error'/,
  };
  const filas = [];
  for (const { r, lines, src } of archivos.filter((a) => esPantalla(a.r))) {
    // Carga datos = importa de la base y llama a alguna función de lectura.
    // Las pantallas que solo escriben (applyGameGrade…) no entran.
    if (!/from '@\/(db|data)\//.test(src) || !/\b(get|count|resumen|list|fetch)[A-Z]\w*\(/.test(src)) continue;
    const ev = Object.fromEntries(Object.entries(RE).map(([k, re]) => [k, primeraLinea(lines, re)]));
    filas.push({ r, ...ev });
  }
  return filas;
}

/** COLOR-1: `backgroundColor: color.world…` fuera del tema (relleno grande), y las excepciones revisadas. */
function auditaColorMarca(archivos) {
  const rellenos = [], exentos = [];
  for (const { r, lines } of archivos) {
    if (r.startsWith('src/theme/')) continue;
    lines.forEach((l, i) => {
      if (esComentario(l)) return;
      const ex = COLOR1_EXCEPCIONES.find((e) => e.archivo === r && e.patron.test(l));
      if (ex) { exentos.push({ r, linea: i + 1, txt: ex.motivo }); return; }
      if (/backgroundColor:\s*[^,\n]*color\.world/.test(l)) rellenos.push({ r, linea: i + 1, txt: `relleno con color de mundo: \`${l.trim().slice(0, 70)}\`` });
    });
  }
  return { rellenos, exentos };
}

/** COLOR-3: colores de marca a los que les falta algún paso de la escala 50–900. */
function auditaEscalas(tokens) {
  return COLORES_DE_MARCA.filter((n) => !PASOS_ESCALA.every((p) => new RegExp(`\\b${n}${p}:`).test(tokens)));
}

/** MOT-1: duraciones, curvas y springs que no salen de `src/theme/motion.ts`. */
function auditaMovimiento(archivos) {
  const REGLAS = [
    [/\bduration\(\s*\d+\s*\)/, 'duración literal'],
    [/\bduration:\s*[1-9]\d*\b/, 'duración literal'],
    [/\.delay\(\s*\d+\s*\)|\bwithDelay\(\s*\d+/, 'retraso literal'],
    [/\bEasing\.\w+/, 'curva fuera de `motion.ts`'],
    [/\bwithSpring\((?![^)]*motionSpring)/, 'spring sin preset'],
    [/\.springify\(|\b(damping|stiffness):\s*\d/, 'spring propio'],
    [/Animated\.timing\(|LayoutAnimation\./, 'API de animación de React Native'],
  ];
  const sueltos = [], exentos = [];
  for (const { r, lines } of archivos) {
    if (r === 'src/theme/motion.ts') continue;
    lines.forEach((l, i) => {
      if (esComentario(l)) return;
      for (const [re, txt] of REGLAS) {
        if (!re.test(l)) continue;
        const ex = MOT1_EXCEPCIONES.find((e) => e.archivo === r && e.patron.test(l));
        (ex ? exentos : sueltos).push({ r, linea: i + 1, txt: ex ? ex.motivo : `${txt}: \`${l.trim().slice(0, 70)}\`` });
        break;
      }
    });
  }
  // MOT-2: todo tocable pasa por `Presionable` (escala 0.97 en `rapido`, o solo opacidad con Reduce Motion).
  const sinFeedback = [];
  const TOCABLE = /<(Pressable|AnimatedPressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback)\b|createAnimatedComponent\(Pressable\)/;
  for (const { r, lines } of archivos) {
    if (r === 'src/shared/ui/Presionable.tsx') continue;
    lines.forEach((l, i) => {
      if (!esComentario(l) && TOCABLE.test(l)) sinFeedback.push({ r, linea: i + 1, txt: 'tocable que no usa `Presionable`' });
    });
  }
  return { sueltos, exentos, sinFeedback };
}

/**
 * La señal en vivo (v5.0). Alcance: los efectos de `src/components/fx/`, Practicar y la barra de pestañas.
 * Los bucles anteriores a la v5.0 (Skeleton) no entran: viven donde ya se veían. Modo oído ya es de la señal.
 */
/** Estudio 5.0: las piezas de la tarjeta y la pantalla que animan (el resto de `card/` es anterior a la señal). */
const ESTUDIO_SENAL = new Set([
  'src/features/estudio/screens/StudyScreen.tsx',
  'src/features/estudio/components/StudyCardView.tsx',
  'src/features/estudio/components/TileBuilder.tsx',
  'src/features/estudio/components/FraseHueco.tsx',
  'src/features/estudio/components/PalabraVoladora.tsx',
  'src/features/estudio/components/DiffFrase.tsx',
  'src/features/estudio/components/BloqueVoz.tsx',
  'src/features/estudio/screens/StudyScreen.tsx',
  'src/features/estudio/components/StudyCardView.tsx',
  'src/shared/ui/OptionButton.tsx',
  'src/features/estudio/components/TileBuilder.tsx',
  'src/features/estudio/components/FraseHueco.tsx',
  'src/features/estudio/components/PalabraVoladora.tsx',
  'src/features/estudio/components/DiffFrase.tsx',
  'src/features/estudio/components/BloqueVoz.tsx',
]);
const ALCANCE_SENAL = (r) =>
  esFx(r) || r === 'src/shared/ui/BarraFina.tsx' || r === 'src/shared/ui/BotonGuardar.tsx' || r === 'src/shared/ui/CorreccionFrase.tsx' ||
  r === 'src/domain/resumenNiveles.ts' || r === 'src/data/local/celebracion.ts' ||
  /^src\/features\/(progreso|detalle|oido|gramatica|phrasal|lecturas|frases-sueltas|errores|atoradas|practicar)\//.test(r) ||
  /^src\/features\/juegos\/(niveles|pares|caida|dulces|colmena|cazala)\//.test(r) ||
  r.startsWith('src/features/sonidos/components/') || r === 'src/features/sonidos/screens/PronunciationScreen.tsx' ||
  r.startsWith('src/features/mazo/components/') || r === 'src/features/mazo/screens/DeckScreen.tsx' ||
  r.startsWith('src/components/fx/') || r.startsWith('src/components/progreso/') || ESTUDIO_SENAL.has(r) ||
  r.startsWith('src/components/detalle/') || r === 'src/features/detalle/screens/DetailScreen.tsx' ||
  r.startsWith('src/components/niveles/') || r === 'src/features/juegos/niveles/screens/NivelesScreen.tsx' ||
  r.startsWith('src/components/juegos/pares/') || r === 'src/features/juegos/pares/screens/ParesScreen.tsx' ||
  r.startsWith('src/components/juegos/caida/') || r === 'src/features/juegos/caida/screens/CaidaScreen.tsx' ||
  r.startsWith('src/components/juegos/dulces/') || r === 'src/features/juegos/dulces/screens/DulcesScreen.tsx' ||
  r.startsWith('src/components/juegos/colmena/') || r === 'src/features/juegos/colmena/screens/ColmenaScreen.tsx' ||
  r.startsWith('src/components/juegos/cazala/') || r === 'src/features/juegos/cazala/screens/CazalaScreen.tsx' ||
  r === 'src/screens/extras/EarModeScreen.tsx' ||
  r.startsWith('src/components/sonidos/') || r === 'src/features/sonidos/screens/PronunciationScreen.tsx' ||
  r.startsWith('src/components/gramatica/') || r === 'src/features/gramatica/screens/GramaticaScreen.tsx' || r === 'src/features/gramatica/screens/GramaticaTemaScreen.tsx' ||
  r.startsWith('src/components/phrasal/') || r === 'src/features/phrasal/screens/PhrasalScreen.tsx' || r === 'src/features/phrasal/screens/PhrasalVerboScreen.tsx' ||
  r.startsWith('src/components/lectura/') || r === 'src/features/lecturas/screens/LecturasScreen.tsx' || r === 'src/features/lecturas/screens/LecturaScreen.tsx' ||
  r.startsWith('src/components/mazo/') || r === 'src/screens/extras/AzarScreen.tsx' ||
  r.startsWith('src/components/errores/') || r === 'src/features/errores/screens/ErrorsScreen.tsx' || r === 'src/features/errores/screens/ErrorDetailScreen.tsx' ||
  r.startsWith('src/components/atoradas/') || r === 'src/features/mazo/screens/DeckScreen.tsx' || r === 'src/features/atoradas/screens/StuckScreen.tsx' ||
  r.startsWith('src/screens/extras/practicar/') || r === 'src/features/practicar/screens/PracticeScreen.tsx' ||
  r === 'src/features/progreso/screens/ProgressScreen.tsx' || r === 'src/app/navegacion/TabNavigator.tsx';
const BUCLE = /\b(useFrameCallback|withRepeat|useReloj)\(/;
const ANIMA = /\b(withTiming|withSpring|withRepeat|withSequence|withDelay|useFrameCallback)\(|entering=/;
/** MOT-3: componentes que son el momento héroe animado de su pantalla. */
const MOMENTOS_HEROE = ['ConsolaHoy', 'MedidorSenal'];
/** MOT-3: los canvases de Skia en bucle que vive cada pantalla (máximo 3 a la vez). */
const LOOPS_POR_PANTALLA = {
  Practicar: ['FondoAurora.tsx', 'OndaSenal.tsx', 'PortadaJuego.tsx'],
  Progreso: ['MedidorSenal.tsx'],
  // El héroe de Estudio (OndaVoz) no es un bucle: lo mueve la posición del audio y solo mientras suena.
  Estudio: [],
  // Detalle: el héroe es la frase con su onda (mismo OndaVoz, movida por el audio); ningún bucle.
  Detalle: [],
  // Niveles: el único bucle es la onda del anillo del nivel actual (`AnilloActual`, con `useReloj`), que no es un canvas de Skia.
  Niveles: [],
  // Pares: el cable (Skia) solo se dibuja mientras hay un arrastre o una unión, y el latido del reloj (`RelojRonda`) no es un canvas; ningún bucle de Skia.
  Pares: [],
  // Caída: la capa de Skia (carriles y estela) se dibuja desde el valor `y` que mueve las fichas y no corre un bucle propio; el piso y su resplandor son vistas.
  Caida: [],
  // Dulces: las partículas de los trozos son un canvas de Skia (`Estallidos`) que solo dibuja mientras vuela alguna; no hay bucle propio.
  Dulces: [],
  // Colmena: el héroe es el panal (fichas SVG movidas por valores compartidos) y la onda de la voz (`OndaVoz`) la mueve el audio; ningún bucle de Skia.
  Colmena: [],
  // Cázala: el héroe es la cacería en el audio (karaoke, pulsos y transformación movidos por la posición de la voz, que solo corre mientras suena); ningún bucle.
  Cazala: [],
  // Modo oído: el héroe es la radio (`AnilloRadio`), un canvas de Skia que solo dibuja mientras suena la voz (un `useFrameCallback` apagado en pausa, sin foco y en segundo plano); es el único de la pantalla.
  ModoOido: ['AnilloRadio.tsx'],
  // Sonidos: el héroe es el mapa de la boca (un punto que viaja una vez, con resorte, y late con la voz mientras suena); SVG y vistas, ningún canvas de Skia ni bucle.
  Sonidos: [],
  // Gramática: el héroe es «El error que se corrige» (la frase incorrecta se tacha y se transforma en la correcta, una vez al llegar a la vista); vistas y layout de Reanimated, ningún canvas de Skia ni bucle.
  Gramatica: [],
  // Phrasal: el héroe es la ruleta de partículas (una rueda de textos movida por un gesto y un resorte en el hilo de UI); vistas, ningún canvas de Skia ni bucle.
  Phrasal: [],
  // Lectura: el héroe es la lectura acompañada (un resaltado que se desliza a la oración que suena y un scroll que la sigue, movidos por la posición del audio); vistas, y la onda mini del pie solo dibuja mientras suena la voz; ningún bucle de Skia.
  Lectura: [],
  // Azar: el héroe es el mazo de cartas (transformaciones movidas por un gesto y resortes en el hilo de UI); vistas, ningún canvas de Skia ni bucle.
  Azar: [],
  // Errores: el héroe del detalle es la señal que se rompe (un cable y un glitch de una sola vez, sin bucles); vistas y un lienzo de Skia que solo dibuja mientras corre la secuencia.
  Errores: [],
  // Mi mazo: el héroe es la tarjeta que se desliza para quitarla (un Pan y resortes en el hilo de UI); ningún canvas de Skia ni bucle.
  Mazo: [],
  // Se me atoran: el héroe es el atasco (puntos que se apagan uno a uno cuando una frase se desatora, una sola vez); ningún canvas de Skia ni bucle.
  Atoradas: [],
};
const MAX_CANVAS_EN_BUCLE = 3;
const MOT5_EXCEPCIONES = [
  { archivo: 'src/app/navegacion/TransicionHoy.tsx', motivo: 'solo se monta si `ConsolaHoy` la pide, y `ConsolaHoy` no la pide con reducir movimiento' },
  { archivo: 'src/features/practicar/components/Destacados.tsx', motivo: '`entering` de Reanimated: salta al valor final con reducir movimiento (`ReduceMotion.System`)' },
  { archivo: 'src/features/practicar/components/EncabezadoPracticar.tsx', motivo: 'anima con el scroll (lo mueve el dedo, no es un bucle) y con `entering`, que salta al valor final con reducir movimiento' },
];

/** MOT-3 (un solo momento héroe; máximo 3 canvases en bucle), MOT-4 (bucles con `useSenalActiva`), MOT-5 (reducir movimiento) e IA-3 (luz de escena). */
function auditaSenal(archivos) {
  const S = { mot3: [], mot4: [], mot5: [], mot5Exentos: [], luz: [], canvasEnBucle: [] };
  for (const { r, lines } of archivos) {
    const enAlcance = ALCANCE_SENAL(r);
    const codigo = lines.map((l) => (esComentario(l) ? '' : l));
    const texto = codigo.join('\n');
    if (esPantalla(r) || r.startsWith('src/screens/') || r.startsWith('src/components/progreso/') || r.startsWith('src/features/progreso/components/')) {
      const n = MOMENTOS_HEROE.reduce((t, c) => t + (texto.match(new RegExp(`<${c}\\b`, 'g')) || []).length, 0);
      if (n > 1) S.mot3.push({ r, linea: primeraLinea(codigo, new RegExp(`<(${MOMENTOS_HEROE.join('|')})\\b`)) ?? 1, txt: `${n} momentos héroe en una pantalla` });
    }
    if (esFx(r) && /shadowColor/.test(texto)) {
      S.luz.push({ r, linea: primeraLinea(codigo, /shadowColor/) ?? 1, txt: 'sombra de color en un efecto: la señal es luz de escena, no sombra' });
    }
    if (!enAlcance) continue;
    const bucle = BUCLE.test(texto);
    if (bucle && /<Canvas\b/.test(texto)) S.canvasEnBucle.push(r);
    if (bucle && r !== 'src/shared/ui/fx/useSenalActiva.ts' && !/\buseSenalActiva\b/.test(texto)) {
      S.mot4.push({ r, linea: primeraLinea(codigo, BUCLE) ?? 1, txt: 'bucle que no consulta `useSenalActiva` (foco, segundo plano, reducir movimiento)' });
    }
    if (ANIMA.test(texto) && !/\b(useMovimientoReducido|useSenalActiva)\b/.test(texto)) {
      const item = { r, linea: primeraLinea(codigo, ANIMA) ?? 1 };
      const ex = MOT5_EXCEPCIONES.find((e) => e.archivo === r);
      if (ex) S.mot5Exentos.push({ ...item, txt: ex.motivo });
      else S.mot5.push({ ...item, txt: 'anima sin consultar `useMovimientoReducido` ni `useSenalActiva`' });
    }
  }
  // Cada canvas en bucle debe vivir en una pantalla, y ninguna pantalla pasa de 3 a la vez.
  const asignados = new Set(Object.values(LOOPS_POR_PANTALLA).flat());
  for (const r of S.canvasEnBucle) {
    if (!asignados.has(r.split('/').pop())) {
      S.mot3.push({ r, linea: 1, txt: 'canvas de Skia en bucle sin pantalla asignada en `LOOPS_POR_PANTALLA` del audit' });
    }
  }
  for (const [pantalla, archivos] of Object.entries(LOOPS_POR_PANTALLA)) {
    if (archivos.length > MAX_CANVAS_EN_BUCLE) {
      S.mot3.push({ r: 'src/shared/ui/fx/', linea: 1, txt: `${pantalla}: ${archivos.length} canvases de Skia en bucle (máximo ${MAX_CANVAS_EN_BUCLE} a la vez)` });
    }
  }
  return S;
}

/** Todas las etiquetas JSX de apertura `<Tag ...>` con sus atributos completos (respeta llaves anidadas). */
function etiquetasJsx(src) {
  const res = []; const re = /<([A-Za-z][\w.]*)(?=[\s>/])/g; let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++; else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    res.push({ nombre: m[1], pos: m.index, linea: lineaDe(src, m.index), texto: src.slice(m.index, i + 1) });
  }
  return res;
}

/** El texto entre el paréntesis que abre en `desde` y el que lo cierra. */
function entreParentesis(src, desde) {
  let d = 0;
  for (let i = desde; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')' && --d === 0) return src.slice(desde + 1, i);
  }
  return src.slice(desde);
}

/**
 * MOT-6: ningún nodo mezcla una animación de layout (`entering`, `exiting`, `layout`) con un `transform` (animado o
 * estático). Reanimated pisa el transform con la animación y avisa `[Reanimated] Property "transform" … may be
 * overwritten by a layout animation`. Se separa en un `Animated.View` exterior con la animación de layout y el
 * componente con el transform adentro. `Presionable` anima su escala en su propio nodo, así que no puede llevarlas.
 * Un estilo animado se busca por su declaración más cercana antes de la etiqueta (varias funciones usan el mismo nombre).
 */
function auditaLayoutTransform(archivos) {
  const res = [];
  for (const { r, src } of archivos) {
    if (!/\b(entering|exiting|layout)=\{/.test(src)) continue;
    const conTransform = new Set([...src.matchAll(/^ {2}(\w+):\s*\{[^}]*\btransform\s*:/gm)].map((m) => m[1]));
    for (const t of etiquetasJsx(src)) {
      if (!/\b(entering|exiting|layout)=\{/.test(t.texto)) continue;
      const motivos = [];
      if (t.nombre === 'Presionable') motivos.push('`Presionable` anima su escala (transform) en su propio nodo');
      const estilo = atributo(t.texto, 'style') ?? '';
      if (/\btransform\s*:/.test(estilo)) motivos.push('transform en línea');
      for (const m of estilo.matchAll(/\bstyles\.(\w+)/g)) if (conTransform.has(m[1])) motivos.push(`estilo estático con transform: \`styles.${m[1]}\``);
      for (const nombre of new Set(estilo.match(/\b[a-z]\w*\b/g) ?? [])) {
        const decl = [...src.slice(0, t.pos).matchAll(new RegExp(`const\\s+${nombre}\\s*=\\s*useAnimatedStyle\\(`, 'g'))].pop();
        if (decl && /\btransform\s*:/.test(entreParentesis(src, decl.index + decl[0].length - 1))) {
          motivos.push(`estilo animado con transform: \`${nombre}\``);
        }
      }
      if (motivos.length) res.push({ r, linea: t.linea, txt: `<${t.nombre}> con animación de layout y ${motivos.join('; ')}` });
    }
  }
  return res;
}

/** b) Texto cortado con numberOfLines={1} donde el contenido importa. */
function auditaTextoCortado(archivos) {
  const importa = [], otros = [];
  for (const { r, lines } of archivos) {
    lines.forEach((l, i) => {
      if (esComentario(l) || !/numberOfLines=\{1\}/.test(l)) return;
      const bloque = lines.slice(Math.max(0, i - 1), i + 4).join(' ');
      // Con `adjustsFontSizeToFit` el texto se encoge: no se corta con "…".
      if (/adjustsFontSizeToFit/.test(bloque)) return;
      const expr = limpia((bloque.match(/numberOfLines=\{1\}[^>]*>\s*\{([^}]+)\}/) || [])[1]);
      const item = { r, linea: i + 1, txt: expr ? `\`{${expr.slice(0, 50)}}\`` : '' };
      (CONTENIDO.test(expr) ? importa : otros).push(item);
    });
  }
  return { importa, otros };
}

/** Todas las etiquetas JSX (de apertura y de cierre) con su posición, para saber quién es hijo directo de quién. */
function etiquetasConCierre(src) {
  const res = []; const re = /<(\/?)([A-Za-z][\w.]*)(?=[\s>/])/g; let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++; else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    const texto = src.slice(m.index, i + 1);
    res.push({ cierre: m[1] === '/', nombre: m[2], texto, auto: /\/>$/.test(texto), linea: lineaDe(src, m.index), fin: i + 1 });
  }
  return res;
}

/** Lo que TXT-2 cuenta como texto de contenido variable: lo de TXT-1 más el verbo, el nombre y la instrucción de una tarjeta. */
const CONTENIDO_FILA = new RegExp(`${CONTENIDO.source}|verbo|name|instruction`, 'i');
/** Lo que en una fila no se encoge: un ícono, un botón, un badge. */
const HERMANOS_FILA = /^(AudioButton|Button|IconButton|Icon|Badge|GrupoAudio|LevelBadge|RiskBadge|RegistroBadge)$/;

/**
 * TXT-2: un texto de contenido variable (una frase, una traducción, un título) que comparte fila con un ícono, un botón
 * o un badge tiene que poder encogerse (`flex`, `flexShrink`, `flexGrow`, `width` o `maxWidth` en su estilo). En una fila
 * de React Native el texto no se encoge por omisión: uno largo empuja al hermano fuera de la tarjeta y su audio queda
 * cortado (el bug de `PhraseBlock`). Un texto fijo y corto («Ver», «Lento») no cuenta: solo el que se pinta con una
 * expresión de contenido. Los estilos se resuelven por nombre dentro del mismo archivo.
 */
function auditaFilaTexto(archivos) {
  const res = [];
  for (const { r, src } of archivos) {
    if (!r.endsWith('.tsx')) continue;
    const estilos = {};
    for (const d of src.matchAll(/^ {2}(\w+):\s*\{([^\n]*)\},?$/gm)) estilos[d[1]] = d[2];
    for (const d of src.matchAll(/^ {2}(\w+):\s*\{\n([\s\S]*?)\n {2}\},?$/gm)) estilos[d[1]] = d[2];
    if (!Object.keys(estilos).length) continue;
    const T = etiquetasConCierre(src);
    const nombresDe = (t) => [...(atributo(t.texto, 'style') ?? '').matchAll(/\bstyles\.(\w+)/g)].map((x) => x[1]);
    const elastico = (t) =>
      /\b(?:flex|flexShrink|flexGrow|width|maxWidth)\s*:/.test(atributo(t.texto, 'style') ?? '') ||
      nombresDe(t).some((n) => /\b(?:flex|flexShrink|flexGrow|width|maxWidth)\s*:/.test(estilos[n] ?? ''));
    const esFila = (t) =>
      /^(?:View|Animated\.View|Pressable|Presionable|Card)$/.test(t.nombre) &&
      (/flexDirection:\s*'row'/.test(atributo(t.texto, 'style') ?? '') ||
        nombresDe(t).some((n) => /flexDirection:\s*'row'/.test(estilos[n] ?? '')));
    for (let i = 0; i < T.length; i++) {
      const t = T[i];
      if (t.cierre || t.auto || !esFila(t)) continue;
      let prof = 0;
      const hijos = [];
      for (let j = i + 1; j < T.length; j++) {
        const u = T[j];
        if (u.cierre) {
          if (prof === 0) break;
          prof--;
          continue;
        }
        if (prof === 0) hijos.push(u);
        if (!u.auto) prof++;
      }
      const hermanos = hijos.filter((h) => HERMANOS_FILA.test(h.nombre));
      if (!hermanos.length) continue;
      for (const h of hijos) {
        if (!/^(?:Text|Animated\.Text)$/.test(h.nombre) || h.auto || elastico(h)) continue;
        const resto = src.slice(h.fin);
        const cuerpo = resto.slice(0, Math.max(0, resto.search(/<\/(?:Animated\.)?Text>/)));
        const expr = (cuerpo.match(/\{([^}]+)\}/) || [])[1];
        if (!expr || !CONTENIDO_FILA.test(expr)) continue;
        res.push({ r, linea: h.linea, txt: `\`{${limpia(expr).slice(0, 40)}}\` comparte fila con ${hermanos.map((x) => `<${x.nombre}>`).join(', ')} y no puede encogerse` });
      }
    }
  }
  return res;
}

/** c) Rendimiento: listas, dependencias inestables, estado por intervalo. */
function auditaRendimiento(archivos) {
  const memo = new Set();
  for (const { src } of archivos) for (const m of src.matchAll(/(?:export\s+)?const (\w+)\s*=\s*memo\(/g)) memo.add(m[1]);
  const R = { listas: [], claves: [], deps: [], intervalos: [], estado: [] };
  for (const x of LISTAS_SIN_VIRTUALIZAR) {
    const a = archivos.find((f) => f.r === x.archivo);
    // Solo cuenta mientras el `.map` siga ahí: al pasar la lista a FlatList el hallazgo se apaga solo.
    const linea = a ? primeraLinea(a.lines, x.patron) : null;
    if (linea) R.listas.push({ r: x.archivo, linea, txt: `sin virtualizar: ${x.motivo}` });
  }
  for (const { r, src, lines } of archivos) {
    for (const tag of ['FlatList', 'SectionList']) {
      for (const t of leeTags(src, tag)) {
        const ke = atributo(t.texto, 'keyExtractor');
        if (ke === null) R.listas.push({ r, linea: t.linea, txt: `${tag} sin \`keyExtractor\`` });
        else if (/,\s*(i|idx|index)\s*\)/.test(ke)) R.listas.push({ r, linea: t.linea, txt: `${tag}: \`keyExtractor\` usa el índice` });
        if (/^\(\)\s*=>/.test((atributo(t.texto, 'ItemSeparatorComponent') || '').trim())) R.listas.push({ r, linea: t.linea, txt: `${tag}: \`ItemSeparatorComponent\` es una función nueva en cada render` });
        const desde = src.indexOf(t.texto);
        // `renderItem={renderItem}` apunta a un callback definido antes: se mira ahí, no en lo que siga a la lista.
        const nombreRender = (atributo(t.texto, 'renderItem') || '').trim();
        const defRender = /^\w+$/.test(nombreRender) ? src.search(new RegExp(`const ${nombreRender}\\s*=`)) : -1;
        const desdeRender = defRender >= 0 ? defRender : src.indexOf('renderItem', desde);
        const item = (src.slice(desdeRender, desdeRender + 400).match(/(?<![\w$])<([A-Z]\w*)/) || [])[1];
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
  const bundled = new Set([...bundledSrc.matchAll(/^\s*'([^']+)':\s*(?:require|\d+,)/gm)].map((m) => m[1]));
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

/** ACC-3: opciones visibles en Practicar con los grupos plegados = 1 acción de HOY + destacados + grupos. */
function opcionesPracticar(leer) {
  const modos = leer('src/features/practicar/logic/modos.ts');
  const grupos = modos.slice(modos.indexOf('GRUPOS = ['), modos.indexOf('] as const')).split("id: '").length - 1;
  const hoy = leer('src/features/practicar/logic/hoy.ts');
  const destacados = Number(hoy.slice(hoy.indexOf('NUM_DESTACADOS = ') + 17).split(';')[0]);
  const destinos = modos.split("    titulo: '").length - 1;
  return { total: 1 + destacados + grupos, destacados, grupos, destinos };
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
  const cuerpo = filas.map((f) => `| \`${corto(f.r)}\` | ${celda(f.carga)} | ${celda(f.vacio)} | ${celda(f.error)} |`).join('\n');
  return `| pantalla (archivo) | carga | vacío | error |\n|---|---|---|---|\n${cuerpo}`;
}

function conteoPorRegla(ctx) {
  const { H, C, E, T, R, A, M, S, acc1, modos, tokensBajos } = ctx;
  const sinE = (k) => E.filter((f) => !f[k]).length;
  return [
    ['COLOR-1', 'colores de mundo que tiñen fondos grandes (portadas tintadas y rellenos)', C.marca + ctx.K.rellenos.length],
    ['COLOR-3', 'colores de marca (acento, primario, neutro) sin escala 50–900', ctx.escalas.length],
    ['COLOR-4', 'pares texto/superficie bajo AA', C.fallos.length],
    ['TIPO-1', 'familias: fuente del sistema, `CharisSIL` sin cargar, `monospace`', ctx.tipo1],
    ['TIPO-2', 'cuerpo < 16 px (estilos de cuerpo en 15, 13 o 12, salvo los descartados a mano)', H.cuerpoMd.length + H.cuerpoSm.length],
    ['TIPO-2b', 'line-height del cuerpo fuera de 1.4–1.6', H.lineHeight.length],
    ['TIPO-4', 'títulos ≥ 28 px sin letterSpacing negativo', H.titulo.length],
    ['ESP-1', 'espaciado fuera de 4/8', H.espacio.length],
    ['ACC-1', 'acción principal no sólida o varios sólidos a la vez', acc1.reales.length + acc1.candidatos.length],
    ['ACC-3', `opciones visibles en Practicar con los grupos plegados (máximo recomendado ${MAX_OPCIONES})`, modos.total],
    ['MOV-1', 'áreas táctiles < 48 dp (estilos + tokens)', H.tactil.length + tokensBajos.length],
    ['IA-1', 'líneas con emojis', H.emoji.length],
    ['IA-1b', 'líneas con glifos de texto como íconos', H.glifo.length],
    ['IA-3', 'sombras de color o fuera de tokens', ctx.sombras],
    ['EST-carga', 'pantallas que cargan datos sin estado de carga', sinE('carga')],
    ['EST-vacio', 'pantallas que cargan datos sin estado vacío', sinE('vacio')],
    ['EST-error', 'pantallas que cargan datos sin estado de error', sinE('error')],
    ['TXT-1', 'texto de contenido cortado con `numberOfLines={1}`', T.importa.length],
    ['TXT-2', 'texto de contenido variable en una fila con ícono, botón o badge sin poder encogerse', ctx.FT.length],
    ['RND-1', 'listas sin `keyExtractor` estable, con ítem sin `memo` o con separador inline', R.listas.length],
    ['RND-2', 'hooks con dependencias que cambian en cada render', R.deps.length],
    ['RND-3', 'estado por intervalo, cuadro o scroll que repinta toda la pantalla', R.intervalos.filter((x) => x.txt.includes('pantalla')).length],
    ['AUD-1', 'audios de los JSON que no están en el bundle o están vacíos', A.faltan + A.vacios.length],
    ['MOT-1', 'duraciones, curvas y springs fuera de `motion.ts` (salvo los relojes revisados)', M.sueltos.length],
    ['MOT-2', 'tocables sin el feedback al presionar (`Presionable`)', M.sinFeedback.length],
    ['MOT-3', 'más de un momento héroe animado por pantalla, o más de 3 canvases de Skia en bucle', S.mot3.length],
    ['MOT-4', 'bucles de la señal que no se pausan fuera de pantalla, sin foco o en segundo plano', S.mot4.length],
    ['MOT-5', 'efectos de la señal que no respetan reducir movimiento', S.mot5.length],
    ['MOT-6', 'nodos con animación de layout (`entering`, `exiting`, `layout`) y un transform en el mismo nodo', ctx.LT.length],
  ];
}

const SECCION_ESTATICA = (c) => `# Auditoría estática

## COLOR

**COLOR-1 · Máximo 3 colores de marca: primario (\`contraste\`), acento (\`accent\`) y neutro.** Los ocho colores de mundo son una familia (misma luminosidad y saturación, solo cambia el tono) y van en chico: un punto, una etiqueta, una barra fina y el tinte de los cubitos. Solo cuentan como marca si tiñen fondos grandes. Portadas tintadas en \`gradiente\` (${c.C.gradTint.length}) y \`backgroundColor: color.world…\` fuera del tema:
${L(c.K.rellenos)}

**Excepción revisada a mano (no cuenta):**
${L(c.K.exentos)}

**COLOR-2 · Degradados dentro de un mismo tono.** Las portadas usan un solo degradado neutro (\`gradiente.neutro\`). El degradado de la señal (\`senal\`) va de \`senalInicio\` a \`senalFin\` (azul marino hondo, cobalto y luz), sin hex nuevos, y \`npm run check:color\` verifica que sus tres pasos no se separen más de 8° de tono. Para revisar: \`filoLuz\` mezcla blanco y el azul del acento, y \`FONDO\`. Usos de \`<LinearGradient\`:
${L(c.H.gradiente)}

**COLOR-3 · Cada color de marca con escala 50–900.** Se exige a \`accent\`, \`contraste\` (primario) y \`neutral\`, con los diez pasos en \`tokens.ts\`. Sin escala completa: ${c.escalas.length ? c.escalas.map((n) => '\`' + n + '\`').join(', ') : 'ninguno'}. Los colores de estado y los de mundo no llevan escala.

**COLOR-4 · Contraste AA (4.5:1).** Pares texto/superficie que fallan (calculados de los tokens):
${c.C.fallos.map((f) => `- \`${f.t}\` sobre \`${f.s}\`: ${f.v.toFixed(2)}`).join('\n') || '- (ninguno)'}

\`text\` sobre \`accent\` da 1.47: usar siempre \`onAccent\`.

## TIPOGRAFÍA

**TIPO-1 · Máximo 2 familias; prohibidas Inter, Roboto, Arial y Space Grotesk como default.** Familias de \`font.family\` (\`tokens.ts\`), cargadas en \`src/app/App.tsx\` con \`useFonts\` (\`src/theme/fuentes.ts\`): Bricolage Grotesque (títulos), Instrument Sans (cuerpo) y Charis SIL (IPA). Un \`fontFamily\` que no salga de \`font.family\`, o un texto sin familia, cae a la fuente del sistema (en Android, **Roboto**). Ocurrencias fuera de \`font.family\`:
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

**ESP-1 · Escala 4/8 (4, 8, 12, 16, 24, 32, 48).** Los tokens \`space\` (\`tokens.ts:214-222\`) coinciden con la escala. Las violaciones son valores sueltos o sumas. Excepciones válidas, que no cuentan: \`padding: 1\` (el filo de luz), los bordes de 1 a 2 px (\`borderWidth\`, que no son espaciado y el audit no mira) y los márgenes negativos de hasta 2 px que compensan un borde.
${L(c.H.espacio)}

**Excepciones revisadas (no cuentan):**
${L(c.H.espacioExento)}

## JERARQUÍA Y ACCIÓN

**ACC-1 · Una sola acción principal, botón sólido de alto contraste.** \`Button\` tiene 4 variantes: \`primary\` (\`primario\`, azul sólido), \`secondary\` (con borde), \`ghost\` y \`danger\` (\`Button.tsx:143-158\`). Revisado leyendo cada render, **los hallazgos reales son:**
${L(c.acc1.reales)}
${c.acc1.candidatos.length ? '\nArchivos nuevos con 2 o más `primary` por verificar:\n' + L(c.acc1.candidatos.map((b) => ({ r: b.r, linea: b.tags[0].linea, txt: b.tags.map((t) => `:${t.linea} ${t.variant}`).join('; ') }))) : ''}

Descartados tras leer el render (no son hallazgo):
${c.acc1.descartados.map(([r, m]) => `- \`${r}\` — ${m}`).join('\n')}

**ACC-3 · Menos opciones (Ley de Hick).** \`PracticeScreen\` (la pestaña de inicio) muestra **${c.modos.total} opciones** con los grupos plegados: 1 acción de HOY + ${c.modos.destacados} destacados + ${c.modos.grupos} grupos, que guardan el resto de los ${c.modos.destinos} destinos. Máximo recomendado ${MAX_OPCIONES}.

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

**IA-3 · Sombras discretas y consistentes; ninguna de color.** El halo de color (\`glow\`) se eliminó: \`primary\` usa \`shadow.soft\` (negra) y la barra de pestañas usa \`shadow.card\`. \`shadow.card\` (opacidad 0.55, radio 20) y \`shadow.raised\` (0.7, radio 32) no son discretas. Sombras definidas fuera de los tokens:
${L(c.H.propio)}

**Excepción (v5.0):** la luz de la señal (aurora, onda, anillo y destello de \`src/components/fx/\`) es luz de escena, no sombra de color. El audit solo exige que ningún archivo de \`fx/\` use \`shadowColor\`:
${L(c.S.luz)}
${c.H.sombra.length ? '\nshadowColor que no es negro:\n' + L(c.H.sombra) : ''}

## Revisión manual (no se puede medir estáticamente)

- **TIPO-3** jerarquía con tamaño y peso, no solo color; **TIPO-5** no mezclar alineaciones en un bloque.
- **ESP-2** proximidad (lo que va junto, cerca; entre secciones, el doble).
- **ACC-2** una sola cosa destacada por pantalla: en Practicar es HOY (\`ConsolaHoy\`, la única superficie \`contraste\`). Las portadas animadas de los destacados y la aurora son ambiente, no un segundo momento héroe (MOT-3).
- **MOV-2** acciones frecuentes en la mitad inferior: en los juegos "Saltar" vive en el \`right\` del \`Header\` (arriba a la derecha).
- **MOV-3** barra inferior: flota (\`TabNavigator.tsx\`, estilo \`bar\`) sobre un \`BlurView\` con filo y una píldora líquida; tiene fondo propio, así que cumple, pero no va pegada al borde.
- **MOV-4** padding que empuja el contenido: revisar en dispositivo.
- **IA-2** tarjetas de distinto tamaño y peso: en Practicar los destacados son una héroe a todo el ancho (180) y dos compactas (150); \`Card\` sigue siendo una sola pieza con filo y sombra \`card\` en el resto de la app.
`;

const SECCION_COMPORTAMIENTO = (c) => {
  const sinE = (k) => c.E.filter((f) => !f[k]).length;
  return `# Auditoría de comportamiento

## a) Estados: carga, vacío y error

Pantallas (\`*/screens/*Screen.tsx\`) que leen de la base (\`@/data/\`). Cada celda apunta a la primera línea que evidencia el estado; ✗ es que no se detectó ninguno. La detección busca nombres de estado (\`loading\`, \`cargando\`, \`useCarga\`, \`<Carga>\`, \`ErrorCarga\`, \`EmptyState\`, \`.length === 0\`, \`.catch\`, \`setError\`), así que un estado con otro nombre saldría ✗ y hay que confirmarlo.

${tablaEstados(c.E)}

Sin carga: ${sinE('carga')} de ${c.E.length} · sin vacío: ${sinE('vacio')} · sin error: ${sinE('error')}.

## b) Texto cortado

\`numberOfLines={1}\` en texto cuyo contenido importa (frases, traducciones, títulos, nombres). Se corta con "…" y el usuario no puede leer el resto:
${L(c.T.importa)}

Otros ${c.T.otros.length} \`numberOfLines={1}\` en etiquetas, contadores y similares no se listan.

**TXT-2 · Un texto de contenido variable en una fila con un ícono, un botón o un badge tiene que poder encogerse** (\`flex\`, \`flexShrink\`, \`flexGrow\`, \`width\` o \`maxWidth\` en su estilo). En una fila de React Native el texto no se encoge por omisión: uno largo empuja a su hermano fuera de la tarjeta y su audio queda cortado (el bug de \`PhraseBlock\`). Hallazgos:
${L(c.FT)}

## c) Rendimiento

**Listas:** \`FlatList\` o \`SectionList\` sin \`keyExtractor\`, con clave por índice, con el ítem sin \`memo\` o con el separador creado en cada render, y colecciones grandes pintadas con \`.map\` dentro de un \`ScrollView\`:
${L(c.R.listas)}

**Dependencias que cambian en cada render** (el efecto o el callback se vuelve a disparar sin necesidad, como pasaba con \`grupos\` en \`ContractionsScreen\`):
${L(c.R.deps)}

**Estado que se actualiza por intervalo, cuadro o scroll** (\`setInterval\`, \`requestAnimationFrame\`, \`onScroll\` con \`setState\`; solo el de una pantalla cuenta como hallazgo, el de un componente hoja es informativo):
${L(c.R.intervalos)}

**Solo informativo (no cuenta):** claves por índice en listas estáticas, que solo importan si la lista se reordena o se filtra:
${L(c.R.claves)}

Pantallas con más de 8 \`useState\` (cualquier cambio repinta la pantalla; no es un bug por sí solo, pero es donde mirar si hay tirones): ${c.R.estado.map((x) => `\`${corto(x.r)}\` ${x.txt.split(' ')[0]}`).join(', ') || 'ninguna'}.

## d) Audio

Los botones de audio no desaparecen cuando falta el archivo: \`AudioButton\` se pinta **apagado** (opacidad 0.4, deshabilitado) si la ruta no está empaquetada ni descargada (\`hayAudio\`, \`AudioButton.tsx\`). Rutas de audio que los JSON de \`assets/data/\` piden y **no están en \`bundled.ts\`** (${c.A.faltan} de ${c.A.total}):

| grupo | pedidas | sin empaquetar |
|---|---|---|
${[...c.A.porGrupo.entries()].sort((a, b) => b[1].faltan.length - a[1].faltan.length).map(([g, v]) => `| \`${g}\` | ${v.total} | ${v.faltan.length}${v.faltan.length ? ` (ej. \`${v.faltan[0]}\`)` : ''} |`).join('\n')}

**Audios vacíos** (empaquetados, pero de menos de ${MIN_BYTES_AUDIO} bytes: \`isBundled\` dice que existen, así que su botón se pinta **activo** y falla en silencio):
${c.A.vacios.map((p) => `- \`assets/${p}\``).join('\n') || '- (ninguno)'}

Archivos que pintan \`<AudioButton>\`: ${c.A.botones.map((b) => `\`${b.r.replace('src/', '')}\` ${b.n}`).join(', ')}.

## e) Movimiento

**MOT-1 · Nada de movimiento fuera de \`src/theme/motion.ts\`.** Cuenta duraciones y retrasos numéricos, \`Easing.*\`, springs sin preset, \`springify\` y las APIs de animación de React Native:
${L(c.M.sueltos)}

**Excepciones revisadas a mano (no cuentan):**
${L(c.M.exentos)}

**MOT-2 · Todo tocable pasa por \`Presionable\`** (escala 0.97 en \`rapido\`; con Reduce Motion baja la opacidad). Cuenta \`Pressable\`, \`AnimatedPressable\` y \`Touchable*\` sueltos:
${L(c.M.sinFeedback)}

**MOT-3 · Un solo momento héroe animado por pantalla** (en Practicar es HOY, \`ConsolaHoy\`) **y como máximo 3 canvases de Skia en bucle a la vez.** Archivos con canvas en bucle (${c.S.canvasEnBucle.length}): ${c.S.canvasEnBucle.map((r) => '\`' + r.split('/').pop() + '\`').join(', ') || 'ninguno'}. Hallazgos:
${L(c.S.mot3)}

**MOT-4 · Todo bucle se pausa fuera de pantalla, sin foco o en segundo plano.** Los efectos de la señal consultan \`useSenalActiva\` (foco + AppState + reducir movimiento) y \`useReloj\` se detiene con \`visible\`. Bucles que no lo hacen:
${L(c.S.mot4)}

**MOT-5 · Con reducir movimiento no hay bucles, tilt, parallax ni marcador; todo queda en su estado final.** Archivos de la señal que animan sin consultar \`useMovimientoReducido\` ni \`useSenalActiva\`:
${L(c.S.mot5)}

**Excepciones revisadas a mano (no cuentan):**
${L(c.S.mot5Exentos)}

**MOT-6 · Ningún nodo mezcla una animación de layout (\`entering\`, \`exiting\`, \`layout\`) con un transform, animado o estático.** Reanimated pisa el transform y avisa \`[Reanimated] Property "transform" … may be overwritten by a layout animation\`. Se separa: un \`Animated.View\` exterior con la animación de layout y, adentro, el componente que anima su transform. \`Presionable\` anima su escala en su propio nodo y por eso su tipo ya no acepta esas tres props. Hallazgos en todo \`src/\`:
${L(c.LT)}

## Notas

- Los íconos salen de \`Icon\` (Phosphor). Quedan flechas y marcas (← → ✓ ✗) como contenido en \`catalogo.json\`, \`gramatica.json\` y \`medios.json\`: son notación de las lecciones, no íconos de interfaz, y el audit no las cuenta.
- \`padding: 1\` (Card, FeedbackBand, MuroDesbloqueo, TabNavigator) es la técnica del filo de luz y no se cuenta en ESP-1.
- \`impeccable detect src\` devolvió 0 hallazgos; sus patrones son de HTML y CSS, así que ese 0 no dice nada de esta app.
- Los bucles anteriores a la v5.0 (\`Skeleton\` mientras carga) quedan fuera de MOT-4 y MOT-5: MOT-3 a MOT-5 se miden sobre la señal (\`src/components/fx/\`, Practicar y la barra de pestañas).
- Los conteos salen de análisis estático: resuelve expresiones con los tokens \`space\` y \`font.size\`, no valores calculados en ejecución.
`;
};

function main() {
  const archivos = walk(path.join(ROOT, 'src')).map((f) => {
    const src = fs.readFileSync(f, 'utf8');
    return { r: rel(f), src, lines: src.split('\n') };
  });
  const leer = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const tokens = leer('src/theme/tokens.ts');
  const H = auditaEstatica(archivos);
  const S = auditaSenal(archivos);
  const coloreadas = (tokens.match(/shadowColor:\s*'#[0-9A-Fa-f]{6}'/g) || []).filter((s) => !/#000000/i.test(s)).length;
  const ctx = {
    H, C: contrastes(tokens), E: auditaEstados(archivos), T: auditaTextoCortado(archivos), R: auditaRendimiento(archivos), M: auditaMovimiento(archivos), S,
    LT: auditaLayoutTransform(archivos),
    FT: auditaFilaTexto(archivos),
    A: auditaAudio(archivos, leer('src/assets/bundled.ts')), acc1: auditaAcc1(H, archivos),
    modos: opcionesPracticar(leer),
    tokensBajos: tokensTactiles(tokens, leer('src/shared/ui/AudioButton.tsx')),
    K: auditaColorMarca(archivos), escalas: auditaEscalas(tokens),
    tipo1: (/fontFamily/.test(leer('src/theme/typography.ts')) ? 0 : 1) + (/ipa:\s*'CharisSIL'/.test(tokens) && !archivos.some((a) => /useFonts\(/.test(a.src)) ? 1 : 0) + H.fuente.length,
    sombras: coloreadas + H.sombra.length + H.propio.length + S.luz.length,
  };
  const previo = leePrevio();
  const filas = conteoPorRegla(ctx);
  const actuales = Object.fromEntries(filas.map(([k, , n]) => [k, n]));
  const plan = previo.plan ?? '<!-- PLAN:start -->\n## Top 10\n\n(pendiente)\n<!-- PLAN:end -->';
  const encabezado = `# Auditoría de diseño

Qué reglas de \`DESIGN.md\` incumple hoy el código y cómo se comporta en pantallas, texto, rendimiento y audio. **No se corrigió nada.**
Se regenera con \`npm run audit:diseno\` (análisis estático de ${archivos.length} archivos de \`src/\`). Las reglas que dependen de juicio visual van en "Revisión manual".

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
