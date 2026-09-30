/**
 * Verifica el interruptor de monetización (src/config/monetizacion.ts):
 *
 *   1. Los puntos que deciden si algo de anuncios se pinta (AdBar, AdFullScreen,
 *      MuroDesbloqueo vía useUnlockStore.abierto, pedirRecompensa,
 *      el padding de Screen) importan y usan ANUNCIOS_ACTIVOS de verdad.
 *   2. Ningún texto visible de anuncios ("PUBLICIDAD", "Ver anuncio", "Con
 *      anuncio"...) vive fuera de un archivo que ya pasa por el interruptor.
 *
 * No renderiza nada (no hay entorno de RN aquí): es un análisis estático del
 * código fuente, igual que check-imports.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const CONFIG = path.join(SRC, 'config', 'monetizacion.ts');

function leer(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const errores = [];

/* ── 1. El interruptor existe y es un booleano literal ─────────────────── */
if (!fs.existsSync(CONFIG)) {
  errores.push(`falta ${path.relative(ROOT, CONFIG)}`);
} else {
  const src = leer('src/config/monetizacion.ts');
  const m = src.match(/export const ANUNCIOS_ACTIVOS\s*=\s*(true|false)\s*;/);
  if (!m) errores.push('src/config/monetizacion.ts no exporta ANUNCIOS_ACTIVOS como booleano literal');
  else console.log(`ANUNCIOS_ACTIVOS = ${m[1]}`);
}

/* ── 2. Los puntos de control usan el interruptor de verdad ─────────────── */
const PUNTOS_DE_CONTROL = [
  { archivo: 'src/shared/ui/Ads.tsx', que: 'AdBar, AdFullScreen, pedirRecompensa' },
  { archivo: 'src/estado/useUnlockStore.ts', que: 'abierto() — lo que decide el muro de MuroDesbloqueo' },
  { archivo: 'src/shared/ui/Screen.tsx', que: 'el padding inferior de toda pantalla con pestañas' },
  { archivo: 'src/features/juegos/niveles/screens/NivelesScreen.tsx', que: 'la celda «anuncio» y el texto de ayuda de Niveles' },
  { archivo: 'src/features/gramatica/screens/GramaticaScreen.tsx', que: 'el candado de los temas de Gramática' },
  { archivo: 'src/features/ajustes/screens/DownloadsScreen.tsx', que: 'el botón de Descargas' },
];

const IMPORT_RE = /import\s*\{\s*ANUNCIOS_ACTIVOS\s*\}\s*from\s*['"]@\/config\/monetizacion['"]/;

for (const { archivo, que } of PUNTOS_DE_CONTROL) {
  if (!fs.existsSync(path.join(ROOT, archivo))) {
    errores.push(`falta ${archivo} (${que})`);
    continue;
  }
  const src = leer(archivo);
  if (!IMPORT_RE.test(src)) {
    errores.push(`${archivo} no importa ANUNCIOS_ACTIVOS de @/config/monetizacion (${que})`);
    continue;
  }
  // Con el import descontado, ANUNCIOS_ACTIVOS debe aparecer al menos una vez más: usado, no solo importado.
  const usos = src.split('ANUNCIOS_ACTIVOS').length - 1;
  if (usos < 2) {
    errores.push(`${archivo} importa ANUNCIOS_ACTIVOS pero no lo usa (${que})`);
  }
}

/* ── 3. Ningún texto de anuncios fuera de un archivo ya gateado ─────────── */
// Frases y textos reales de la app (no nombres de función como anuncioDeError,
// que son "anuncio" en el sentido de "avisar al lector de pantalla", no de
// publicidad).
const TEXTOS_DE_ANUNCIO = [
  /PUBLICIDAD/,
  /Ver anuncio y descargar/,
  /Ver anuncio y abrir/,
  /Cerrar anuncio/,
  /Con anuncio/,
  /se abre con un anuncio/i,
  /Un anuncio, una sola vez/,
  /No hay anuncios disponibles/,
  /Se cerró el anuncio/,
  />\s*Anuncio\s*</,
];

// Estos archivos SÍ pueden mencionar anuncios en su código o comentarios: son
// los que ya deciden, a través del interruptor (directo o por un helper que
// lo consulta), si ese texto llega a pintarse.
const PERMITIDOS = new Set(
  [
    'src/config/monetizacion.ts',
    'src/services/anuncios.ts',
    'src/shared/ui/Ads.tsx',
    'src/shared/ui/MuroDesbloqueo.tsx',
    'src/features/gramatica/components/RenglonTema.tsx',
    'src/features/juegos/niveles/components/CeldaNivel.tsx',
    'src/features/juegos/niveles/components/DesbloqueoCelda.tsx',
    'src/shared/ui/fx/BordePunteado.tsx',
    'src/features/juegos/niveles/screens/NivelesScreen.tsx',
    'src/features/ajustes/screens/DownloadsScreen.tsx',
    'src/features/gramatica/screens/GramaticaScreen.tsx',
    'src/features/gramatica/screens/GramaticaTemaScreen.tsx',
    'src/estado/useUnlockStore.ts',
    'src/data/repos/desbloqueos.ts',
    'src/data/repos/niveles.ts',
    'src/data/esquema.ts',
    'src/domain/niveles.ts',
    'src/app/navegacion/TabNavigator.tsx',
  ].map((p) => path.join(ROOT, p))
);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const fueraDeLugar = [];
for (const f of walk(SRC)) {
  if (PERMITIDOS.has(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const re of TEXTOS_DE_ANUNCIO) {
    if (re.test(src)) {
      fueraDeLugar.push(`${path.relative(ROOT, f)} -> ${re}`);
      break;
    }
  }
}

console.log(`\npuntos de control revisados: ${PUNTOS_DE_CONTROL.length}`);
console.log(`archivos con texto de anuncio fuera de lugar: ${fueraDeLugar.length}`);
for (const f of fueraDeLugar) console.log(`  ${f}`);

if (errores.length > 0) {
  console.error(`\n${errores.length} problema(s):`);
  for (const e of errores) console.error(`  ${e}`);
}

process.exit(errores.length === 0 && fueraDeLugar.length === 0 ? 0 : 1);
