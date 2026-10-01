/**
 * Candados de rendimiento (prompt 6, docs/RENDIMIENTO.md «Presupuestos y candados»). Falla si encuentra algo que ya
 * se arregló en la serie y no debe volver:
 *
 *  1. `.map()` de listas de datos dentro de un ScrollView (o `<Screen scroll>`) más allá de las revisadas.
 *  2. TouchableOpacity / TouchableHighlight (todo lo que se toca pasa por Presionable).
 *  3. `Modal` de react-native fuera de los archivos permitidos.
 *  4. `measure()` de Reanimated sin revisar si regresó null.
 *  5. setInterval o addEventListener/addListener en un efecto sin su limpieza en el mismo efecto.
 *  6. `Image` de react-native en vez de expo-image.
 *  7. console.* fuera de __DEV__ (salvo console.error).
 *  8. JSON de assets/data o el mapa de medios importados arriba de un módulo del arranque.
 *  9. Archivos de más de 400 líneas, salvo las excepciones de abajo.
 *
 * Las excepciones van aquí, con su motivo. Agregar una es una decisión: se revisa en el PR.
 *
 *   node scripts/check-perf.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

/** 1 · Archivos con .map() en JSX dentro de un ScrollView, revisados: cuántos se permiten y por qué. */
const MAP_EN_SCROLL = {
  'src/features/estudio/components/TileBuilder.tsx': [5, 'fichas de una frase (≤ 12)'],
  'src/features/sonidos/screens/ContractionsScreen.tsx': [3, 'pestañas de grupo y las reducciones del grupo abierto (≤ 20)'],
  'src/features/sonidos/components/IndiceFonemas.tsx': [3, '44 fonemas en su cuadrícula, sin imágenes'],
  'src/features/sonidos/components/PaginaFonema.tsx': [2, 'ejemplos de un fonema (≤ 8)'],
  'src/features/juegos/pares/screens/ParesScreen.tsx': [2, 'fichas del tablero (≤ 16)'],
  'src/features/estudio/components/StudyCardView.tsx': [2, 'opciones de una tarjeta (4)'],
  'src/features/errores/screens/ErrorsScreen.tsx': [2, 'chips de categoría y de orden (≤ 10); la lista es FlatList'],
  'src/shared/ui/HojaConsentimiento.tsx': [1, 'renglones de un consentimiento (≤ 5)'],
  'src/features/sonidos/screens/PronunciationScreen.tsx': [1, 'pares de un fonema (≤ 10)'],
  'src/features/juegos/cazala/screens/CazalaScreen.tsx': [1, 'palabras de una frase (≤ 12)'],
  'src/features/ajustes/screens/DiagnosticsScreen.tsx': [1, 'un renglón por archivo de contenido (11)'],
  'src/features/ajustes/screens/DownloadsScreen.tsx': [1, 'packs descargables (≤ 20)'],
  'src/features/ajustes/screens/ProbarVozScreen.tsx': [3, 'solo __DEV__: pruebas de voz'],
  'src/features/ajustes/screens/SfxSamplerScreen.tsx': [2, 'solo __DEV__: 4 paquetes y sus efectos'],
  'src/features/cuenta/screens/BorrarScreen.tsx': [1, 'lo que se borra (≤ 6 renglones)'],
  'src/features/gramatica/screens/GramaticaScreen.tsx': [1, '9 bloques; los temas solo del bloque abierto'],
  'src/features/gramatica/screens/GramaticaTemaScreen.tsx': [2, 'secciones y ejemplos de un tema (≤ 10)'],
  'src/features/lecturas/screens/LecturasScreen.tsx': [1, '24 lecturas, sin imágenes'],
  'src/features/practicar/screens/PracticeScreen.tsx': [1, 'grupos plegables de modos (≤ 6)'],
  'src/features/progreso/screens/ProgressScreen.tsx': [5, 'leyendas y filas de estadísticas (≤ 8 cada una)'],
  'src/features/vocabulario/screens/ExploreScreen.tsx': [1, '8 mundos'],
  'src/features/vocabulario/screens/WorldDetailScreen.tsx': [1, 'packs de un mundo (≤ 17)'],
};
/** Tope para un archivo nuevo con .map() en un ScrollView sin revisar: 0 (hay que revisarlo y anotarlo arriba). */

/** 3 · Donde sí puede haber un Modal de react-native. */
const MODAL_PERMITIDO = new Set(['src/shared/ui/HojaConsentimiento.tsx']);

/** 5 · Listeners a nivel de módulo, que viven lo que vive la app a propósito. */
const LISTENER_DE_MODULO = new Set([
  'src/services/musica.ts', // pausa la música al ir a segundo plano, toda la vida de la app
  'src/shared/hooks/usePrimerPlano.ts', // un solo AppState compartido: se quita con el último suscriptor
]);

/** 8 · Módulos que se evalúan en el arranque en frío. */
const ARRANQUE = [
  'src/app/App.tsx',
  'src/app/navegacion/RootNavigator.tsx',
  'src/app/navegacion/TabNavigator.tsx',
  'src/app/arranque/BootScreen.tsx',
  'src/features/practicar/screens/PracticeScreen.tsx',
  'src/features/practicar/hooks/usePracticar.ts',
];

/** 9 · Archivos que pueden pasar de 400 líneas. */
const LARGOS = {
  'src/features/cuenta/legal/textos.ts': 'generado por scripts/legal.mjs desde docs/legal/',
  'src/features/juegos/dulces/hooks/usePartidaDulces.ts': 'la máquina de la partida (406); partirla toca la lógica de turnos',
  'src/features/juegos/dulces/components/TableroDulces.tsx': 'el tablero fuera del React Compiler con sus memos a mano (404)',
};
const MAX_LINEAS = 400;

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p.includes(`${path.sep}assets${path.sep}`)) continue;
      archivos(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const fallas = [];
const falla = (r, n, txt) => fallas.push(`${r}:${n} — ${txt}`);
const sinComentarios = (l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l.replace(/\/\/.*$/, ''));

/** El bloque de un `useEffect(` / `useLayoutEffect(` / `useFocusEffect(`: de la llamada a su paréntesis de cierre. */
function efectos(texto) {
  const out = [];
  const re = /\b(useEffect|useLayoutEffect|useFocusEffect)\(/g;
  let m;
  while ((m = re.exec(texto))) {
    let d = 0;
    let i = m.index + m[0].length - 1;
    for (; i < texto.length; i++) {
      if (texto[i] === '(') d++;
      else if (texto[i] === ')' && --d === 0) break;
    }
    out.push({ inicio: m.index, cuerpo: texto.slice(m.index, i + 1) });
  }
  return out;
}
const lineaDe = (texto, idx) => texto.slice(0, idx).split('\n').length;

for (const abs of archivos(SRC)) {
  const r = path.relative(ROOT, abs).split(path.sep).join('/');
  const texto = fs.readFileSync(abs, 'utf8');
  const lineas = texto.split('\n');
  const codigo = lineas.map(sinComentarios);
  const plano = codigo.join('\n');

  // 1
  if (/<ScrollView\b|<Screen\b[^>]*\bscroll\b/.test(plano)) {
    const n = codigo.filter((l) => /\{\s*[\w.?!]+(\([^)]*\))?\.map\(/.test(l)).length;
    const [permitidos, motivo] = MAP_EN_SCROLL[r] ?? [0, ''];
    if (n > permitidos) {
      falla(r, 1, `${n} .map() en JSX dentro de un ScrollView (revisados: ${permitidos}${motivo ? `, ${motivo}` : ''}). Si la lista puede crecer, FlatList; si es chica, anótala en MAP_EN_SCROLL con su tope`);
    }
  }

  codigo.forEach((l, i) => {
    const n = i + 1;
    // 2
    if (/\bTouchable(Opacity|Highlight)\b/.test(l)) falla(r, n, 'Touchable*: usa Presionable');
    // 3
    if (/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*'react-native'/.test(l) && !MODAL_PERMITIDO.has(r)) {
      falla(r, n, 'Modal de react-native: usa shared/ui/Hoja (o agrega el archivo a MODAL_PERMITIDO con motivo)');
    }
    // 6
    if (/import\s*\{[^}]*\bImage\b[^}]*\}\s*from\s*'react-native'/.test(l)) falla(r, n, 'Image de react-native: usa expo-image');
    // 7
    if (/\bconsole\.(log|warn|info|debug)\(/.test(l)) {
      const contexto = codigo.slice(Math.max(0, i - 3), i + 1).join('\n');
      if (!/__DEV__/.test(contexto)) falla(r, n, 'console fuera de __DEV__');
    }
    // 4
    if (/(^|[^.\w])measure\(/.test(l) && !/function measure/.test(l)) {
      const siguiente = codigo.slice(i, i + 4).join('\n');
      if (!/(===|==|!==|!=)\s*null|if\s*\(\s*!\s*\w+|\?\.|\?\?/.test(siguiente)) falla(r, n, 'measure() sin revisar null');
    }
  });

  // 5
  for (const ef of efectos(plano)) {
    const c = ef.cuerpo;
    const n = lineaDe(plano, ef.inicio);
    if (/\bsetInterval\(/.test(c) && !/\bclearInterval\(/.test(c)) falla(r, n, 'setInterval en un efecto sin clearInterval');
    if (/\.(addEventListener|addListener)\(/.test(c) && !/\.remove\(\)|removeEventListener|removeListener|return\s+\w+(\.\w+)?\(|return\s*\(\)\s*=>/.test(c)) {
      falla(r, n, 'listener en un efecto sin quitarlo en el mismo efecto');
    }
  }
  // 5 · listeners fuera de cualquier efecto (a nivel de módulo)
  if (!LISTENER_DE_MODULO.has(r)) {
    const dentro = efectos(plano).map((e) => [e.inicio, e.inicio + e.cuerpo.length]);
    const re = /\b(AppState|Keyboard|BackHandler|Dimensions)\.(addEventListener|addListener)\(/g;
    let m;
    while ((m = re.exec(plano))) {
      const idx = m.index;
      if (dentro.some(([a, b]) => idx >= a && idx < b)) continue;
      // Dentro de una función que devuelve la baja (p. ej. vaciarConMemoriaBaja) también vale.
      const resto = plano.slice(idx, idx + 400);
      if (/\.remove\(\)/.test(resto)) continue;
      falla(r, lineaDe(plano, idx), 'listener fuera de un efecto y sin baja (si es de toda la app, anótalo en LISTENER_DE_MODULO)');
    }
  }

  // 8
  if (ARRANQUE.includes(r)) {
    codigo.forEach((l, i) => {
      if (/^import\b.*from\s*'@data\/[^']+\.json'/.test(l) || /^import\b.*from\s*'@\/assets\/(bundled|medios)/.test(l)) {
        falla(r, i + 1, 'JSON de contenido o mapa de medios importado arriba de un módulo del arranque: cárgalo perezoso');
      }
    });
  }
  // 8 · en cualquier módulo, un JSON de contenido grande importado arriba (no perezoso)
  codigo.forEach((l, i) => {
    if (/^import\b.*from\s*'@data\/(catalogo|errores|fonemas|gramatica|niveles|phrasal_verbs|lecturas|cazala_entradas)\.json'/.test(l)) {
      falla(r, i + 1, 'JSON grande importado arriba del módulo: pásalo por loadContent (perezoso)');
    }
  });

  // 9
  if (lineas.length > MAX_LINEAS && !LARGOS[r]) falla(r, lineas.length, `${lineas.length} líneas (máximo ${MAX_LINEAS})`);
}

for (const r of Object.keys(LARGOS)) {
  const abs = path.join(ROOT, r);
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').split('\n').length <= MAX_LINEAS) {
    console.log(`  aviso: ${r} ya no pasa de ${MAX_LINEAS} líneas; quítalo de LARGOS`);
  }
}

if (fallas.length) {
  console.log(`check:perf · ${fallas.length} problema(s):\n`);
  for (const f of fallas) console.log(`  ${f}`);
  process.exit(1);
}
console.log('check:perf ok · 9 candados: listas en ScrollView, Touchable, Modal, measure, efectos con limpieza, Image, console, JSON en el arranque, archivos largos');
