/**
 * Guarda contra el crash de useVisibilidad («Value is null, expected an
 * Object» en measure()):
 *
 *   1. Cada llamada a measure( en src/ tiene, en las 3 líneas siguientes,
 *      una guarda `=== null` sobre su resultado.
 *   2. Ninguna llamada a measure( vive dentro de un useAnimatedReaction (es
 *      decir, corriendo una vez por cuadro): solo debe llamarse desde un
 *      manejador puntual (onLayout) via runOnUI.
 *   3. useVisibilidad sigue cortando a "no visible" por foco (useIsFocused)
 *      y por segundo plano (AppState), sin volver a medir.
 *
 * No monta componentes (el repo no tiene jest-expo ni
 * @testing-library/react-native configurados): es un análisis estático del
 * código fuente, igual que check-imports.mjs. El montaje/desmontaje real en
 * pantalla se prueba a mano en el teléfono (ver PRUEBA en la tarea).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const errores = [];
let totalMeasure = 0;

for (const f of walk(SRC)) {
  const src = fs.readFileSync(f, 'utf8');
  const lineas = src.split('\n');

  lineas.forEach((linea, i) => {
    const recortada = linea.trim();
    // Líneas de comentario (// o dentro de un bloque /** */) no cuentan: solo código real.
    if (/^(\/\/|\*|\/\*)/.test(recortada)) return;
    if (!/\bmeasure\(/.test(linea)) return;
    totalMeasure++;
    const rel = path.relative(ROOT, f);
    const ventana = lineas.slice(i, i + 4).join('\n');
    if (!/===\s*null/.test(ventana)) {
      errores.push(`${rel}:${i + 1} -- measure( sin guarda "=== null" en las líneas siguientes`);
    }
  });

  // Ninguna llamada a measure( debe vivir dentro del cuerpo de un
  // useAnimatedReaction (correría una vez por cuadro, no puntual).
  const reactionRe = /useAnimatedReaction\(/g;
  let m;
  while ((m = reactionRe.exec(src))) {
    // Recorta desde el paréntesis que abre useAnimatedReaction( hasta su cierre balanceado.
    let profundidad = 0;
    let inicio = src.indexOf('(', m.index);
    let fin = inicio;
    for (let j = inicio; j < src.length; j++) {
      if (src[j] === '(') profundidad++;
      else if (src[j] === ')') {
        profundidad--;
        if (profundidad === 0) {
          fin = j;
          break;
        }
      }
    }
    const cuerpo = src.slice(inicio, fin);
    if (/\bmeasure\(/.test(cuerpo)) {
      errores.push(`${path.relative(ROOT, f)} -- measure( dentro de un useAnimatedReaction (correría por cuadro)`);
    }
  }
}

// useVisibilidad corta por foco y por segundo plano, sin medir.
const archivoVisibilidad = path.join(SRC, 'components/fx/useVisibilidad.ts');
if (!fs.existsSync(archivoVisibilidad)) {
  errores.push('falta src/components/fx/useVisibilidad.ts');
} else {
  const src = fs.readFileSync(archivoVisibilidad, 'utf8');
  if (!/useIsFocused/.test(src)) errores.push('useVisibilidad.ts ya no corta por foco (useIsFocused)');
  if (!/AppState/.test(src)) errores.push('useVisibilidad.ts ya no corta por segundo plano (AppState)');
}

console.log(`llamadas a measure( encontradas: ${totalMeasure}`);
console.log(`problemas: ${errores.length}`);
for (const e of errores) console.log(`  ${e}`);

process.exit(errores.length === 0 ? 0 : 1);
