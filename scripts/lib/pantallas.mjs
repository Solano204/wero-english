/**
 * Las pantallas de la app y el código que es de cada una, para los chequeos estáticos.
 *
 * Una pantalla es `src/features/<feature>/…/screens/<Nombre>Screen.tsx` o `src/app/arranque/BootScreen.tsx`.
 * Las pantallas son delgadas: lo que hacen (cargar, sonar, cortar el audio) suele vivir en un hook de su
 * feature. `fuenteDePantalla` junta el texto de la pantalla con el de los archivos de SU feature que importa
 * (sus hooks y su logic), siguiendo los imports dentro de la feature. Así un chequeo como «esta pantalla
 * corta el audio al salir» sigue siendo verdad aunque la llamada viva en `usePartidaDulces`.
 */
import fs from 'node:fs';
import path from 'node:path';

const EXT = ['.ts', '.tsx'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Rutas absolutas de todas las pantallas. */
export function pantallas(root) {
  const src = path.join(root, 'src');
  const lista = walk(path.join(src, 'features')).filter((f) => /[\\/]screens[\\/][^\\/]+Screen\.tsx$/.test(f));
  const boot = path.join(src, 'app', 'arranque', 'BootScreen.tsx');
  if (fs.existsSync(boot)) lista.push(boot);
  return lista.sort();
}

function resolver(spec, desde, root) {
  let base;
  if (spec.startsWith('@/')) base = path.join(root, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(desde), spec);
  else return null;
  for (const e of ['', ...EXT, ...EXT.map((x) => '/index' + x)]) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

/** La carpeta de la feature de un archivo (`src/features/juegos/dulces`, `src/features/estudio`…), o null. */
function carpetaFeature(f, root) {
  const rel = path.relative(path.join(root, 'src', 'features'), f).split(path.sep);
  if (rel[0] === '..' || rel.length < 2) return null;
  // juegos/<juego>/… es una feature con subcarpetas: cada juego cuenta como su propia carpeta.
  const partes = rel[0] === 'juegos' && rel.length > 2 ? rel.slice(0, 2) : rel.slice(0, 1);
  return path.join(root, 'src', 'features', ...partes);
}

/** El texto de la pantalla más el de los hooks y la logic de su misma feature que importa (siguiendo sus imports). */
export function fuenteDePantalla(f, root) {
  const carpeta = carpetaFeature(f, root);
  const vistos = new Set([f]);
  const pendientes = [f];
  let texto = '';
  while (pendientes.length > 0) {
    const actual = pendientes.shift();
    const src = fs.readFileSync(actual, 'utf8');
    texto += `\n${src}`;
    if (!carpeta) continue;
    for (const m of src.matchAll(/(?:from\s+|require\()\s*['"]([^'"]+)['"]/g)) {
      const destino = resolver(m[1], actual, root);
      // Solo lo que se sacó de la pantalla: sus hooks y su lógica. Los componentes son de la vista.
      const esSuyo = destino && destino.startsWith(carpeta + path.sep) && /[\\/](hooks|logic)[\\/]/.test(destino);
      if (destino && esSuyo && !vistos.has(destino)) {
        vistos.add(destino);
        pendientes.push(destino);
      }
    }
  }
  return texto;
}
