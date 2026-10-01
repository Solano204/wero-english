/**
 * Los textos legales tienen una sola fuente: docs/PRIVACIDAD.md, docs/TERMINOS.md y
 * docs/ELIMINAR_CUENTA.md. Este script genera a partir de ellos:
 *
 *   - src/features/cuenta/legal/textos.ts: lo que se lee dentro de la app, empaquetado (funciona sin internet);
 *   - docs/web/*.html: las páginas para publicar (GitHub Pages o Netlify; ver docs/web/LEEME.md).
 *
 *   npm run legal:generar   escribe los dos
 *   npm run check:legal     falla si lo generado no coincide con los .md, o si la fecha del
 *                           aviso no es FECHA_AVISO de src/config/legal.ts
 *
 * Markdown que entiende (a propósito, poco): #, ##, ###, párrafos, listas «- » y «1. »,
 * **negrita**, *cursiva* y [texto](url). Lo que va entre <!-- --> no se publica, salvo
 * <!-- fecha: AAAA-MM-DD -->, que es la fecha de última actualización.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOCS = [
  { id: 'privacidad', md: 'docs/PRIVACIDAD.md', html: 'privacidad.html' },
  { id: 'terminos', md: 'docs/TERMINOS.md', html: 'terminos.html' },
  { id: 'eliminar', md: 'docs/ELIMINAR_CUENTA.md', html: 'eliminar-cuenta.html' },
];
const SALIDA_TS = 'src/features/cuenta/legal/textos.ts';
const SALIDA_WEB = 'docs/web';

function partesDe(linea) {
  const partes = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)|\*(.+?)\*/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(linea))) {
    if (m.index > ultimo) partes.push({ texto: linea.slice(ultimo, m.index) });
    if (m[1] !== undefined) partes.push({ texto: m[1], negrita: true });
    else if (m[2] !== undefined) partes.push({ texto: m[2], url: m[3] });
    else partes.push({ texto: m[4], cursiva: true });
    ultimo = re.lastIndex;
  }
  if (ultimo < linea.length) partes.push({ texto: linea.slice(ultimo) });
  return partes;
}

export function parsear(md, archivo) {
  const fecha = /<!--\s*fecha:\s*(\d{4}-\d{2}-\d{2})\s*-->/.exec(md)?.[1];
  if (!fecha) throw new Error(`${archivo}: falta <!-- fecha: AAAA-MM-DD -->`);
  const limpio = md.replace(/<!--[\s\S]*?-->/g, '');
  let titulo = null;
  const bloques = [];
  let parrafo = [];
  const cerrar = () => {
    if (parrafo.length) bloques.push({ t: 'p', partes: partesDe(parrafo.join(' ')) });
    parrafo = [];
  };
  for (const cruda of limpio.split('\n')) {
    const l = cruda.trim();
    let m;
    if (!l) cerrar();
    else if ((m = /^# (.+)$/.exec(l))) {
      cerrar();
      if (titulo) throw new Error(`${archivo}: más de un título #`);
      titulo = m[1];
    } else if ((m = /^(##|###) (.+)$/.exec(l))) {
      cerrar();
      bloques.push({ t: m[1] === '##' ? 'h2' : 'h3', partes: partesDe(m[2]) });
    } else if ((m = /^- (.+)$/.exec(l))) {
      cerrar();
      bloques.push({ t: 'li', partes: partesDe(m[1]) });
    } else if ((m = /^(\d+)\. (.+)$/.exec(l))) {
      cerrar();
      bloques.push({ t: 'ol', n: Number(m[1]), partes: partesDe(m[2]) });
    } else if (/^\|/.test(l)) {
      throw new Error(`${archivo}: las tablas no se soportan (la app no las puede mostrar bien): usa listas`);
    } else parrafo.push(l);
  }
  cerrar();
  if (!titulo) throw new Error(`${archivo}: falta el título #`);
  return { titulo, fecha, bloques };
}

function generarTs(textos) {
  return `/* Generado por scripts/legal.mjs a partir de docs/*.md. No se edita a mano: npm run legal:generar */
import type { DocLegal, TextoLegal } from '@/types/legal';

export const TEXTOS: Record<DocLegal, TextoLegal> = ${JSON.stringify(textos, null, 2)};
`;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlPartes(partes) {
  return partes
    .map((p) => {
      let h = esc(p.texto);
      if (p.negrita) h = `<strong>${h}</strong>`;
      if (p.cursiva) h = `<em>${h}</em>`;
      if (p.url) h = `<a href="${esc(p.url)}">${h}</a>`;
      return h;
    })
    .join('');
}

function htmlCuerpo(bloques) {
  const out = [];
  let lista = null;
  const cerrarLista = () => {
    if (lista) out.push(`</${lista}>`);
    lista = null;
  };
  for (const b of bloques) {
    const tipoLista = b.t === 'li' ? 'ul' : b.t === 'ol' ? 'ol' : null;
    if (tipoLista !== lista) {
      cerrarLista();
      if (tipoLista) {
        out.push(`<${tipoLista}>`);
        lista = tipoLista;
      }
    }
    if (b.t === 'li' || b.t === 'ol') out.push(`  <li>${htmlPartes(b.partes)}</li>`);
    else out.push(`<${b.t}>${htmlPartes(b.partes)}</${b.t}>`);
  }
  cerrarLista();
  return out.join('\n');
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLegible = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
};

const CSS = `
:root { color-scheme: light dark; --fondo: #fbf8fc; --texto: #221b29; --suave: #5f566a; --acento: #a3246d; --linea: #e6dfe9; }
@media (prefers-color-scheme: dark) { :root { --fondo: #0f0b14; --texto: #f5eef8; --suave: #b5a9bd; --acento: #f07cb8; --linea: #2c2338; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--fondo); color: var(--texto); font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
header { border-bottom: 1px solid var(--linea); margin-bottom: 1.5rem; padding-bottom: 1rem; }
.marca { font-weight: 800; color: var(--acento); text-decoration: none; font-size: 1.25rem; }
h1 { font-size: 1.9rem; line-height: 1.2; margin: 1rem 0 .25rem; }
h2 { font-size: 1.3rem; margin: 2rem 0 .5rem; }
h3 { font-size: 1.1rem; margin: 1.5rem 0 .25rem; }
.fecha { color: var(--suave); margin: 0; }
a { color: var(--acento); }
li { margin: .25rem 0; }
nav { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--linea); display: flex; flex-wrap: wrap; gap: 1rem; }
`.trim();

function pagina({ titulo, fecha, cuerpo, actual }) {
  const nav = DOCS.filter((d) => d.html !== actual)
    .map((d) => `<a href="${d.html}">${esc(TITULOS_WEB[d.id])}</a>`)
    .join('\n    ');
  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · Wero</title>
<style>
${CSS}
</style>
</head>
<body>
<main>
  <header><a class="marca" href="index.html">Wero</a></header>
  <h1>${esc(titulo)}</h1>
  ${fecha ? `<p class="fecha">Última actualización: ${fechaLegible(fecha)}</p>` : ''}
${cuerpo}
  <nav>
    ${nav}
  </nav>
</main>
</body>
</html>
`;
}

const TITULOS_WEB = { privacidad: 'Aviso de privacidad', terminos: 'Términos y condiciones', eliminar: 'Cómo eliminar tu cuenta' };

export function generar() {
  const textos = {};
  const archivos = { [SALIDA_TS]: '' };
  for (const d of DOCS) {
    const t = parsear(fs.readFileSync(path.join(ROOT, d.md), 'utf8'), d.md);
    textos[d.id] = t;
    archivos[`${SALIDA_WEB}/${d.html}`] = pagina({ titulo: t.titulo, fecha: t.fecha, cuerpo: htmlCuerpo(t.bloques), actual: d.html });
  }
  archivos[SALIDA_TS] = generarTs(textos);
  archivos[`${SALIDA_WEB}/index.html`] = pagina({
    titulo: 'Wero: textos legales',
    fecha: null,
    cuerpo: `<p>Wero es una app para aprender inglés. Todo lo que guarda sobre ti vive solo en tu teléfono.</p>\n<ul>\n${DOCS.map((d) => `  <li><a href="${d.html}">${esc(TITULOS_WEB[d.id])}</a></li>`).join('\n')}\n</ul>`,
    actual: 'index.html',
  });
  return { textos, archivos };
}

function fechaAviso() {
  const src = fs.readFileSync(path.join(ROOT, 'src/config/legal.ts'), 'utf8');
  return /FECHA_AVISO\s*=\s*'(\d{4}-\d{2}-\d{2})'/.exec(src)?.[1];
}

const soloRevisar = process.argv.includes('--check');
const { textos, archivos } = generar();
const problemas = [];

if (textos.privacidad.fecha !== fechaAviso()) {
  problemas.push(`la fecha de docs/PRIVACIDAD.md (${textos.privacidad.fecha}) no es FECHA_AVISO de src/config/legal.ts (${fechaAviso()})`);
}
for (const [rel, contenido] of Object.entries(archivos)) {
  const abs = path.join(ROOT, rel);
  if (soloRevisar) {
    const actual = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (actual !== contenido) problemas.push(`${rel} no está al día con los .md: corre npm run legal:generar`);
  } else {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contenido);
  }
}

const pendientes = Object.values(textos).reduce((n, t) => n + JSON.stringify(t).split('[COMPLETAR').length - 1, 0);
console.log(`${soloRevisar ? 'revisados' : 'generados'}: ${Object.keys(archivos).length} archivos`);
console.log(`[COMPLETAR] pendientes en los textos: ${pendientes}`);
for (const p of problemas) console.log(`  ✗ ${p}`);
process.exit(problemas.length ? 1 : 0);
