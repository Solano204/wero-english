/**
 * Lo puro de Gramática: partir la fórmula de un tema en renglones y fichas, y saber cuántos niveles hay. Se prueba con
 * `npm run check:gramatica` sobre los 80 temas reales.
 *
 * Las fórmulas del catálogo separan alternativas con «·» («he / she / it + verbo **-s** · I / you + verbo») y las
 * partes de cada una con «+». Lo que cambia respecto a la otra regla viene marcado en los datos con `**` (la «-s», el
 * «-ing»): de ahí sale el resaltado, no se adivina.
 */

/** Un trozo de texto, con o sin la marca `**` de los datos. */
export interface Segmento {
  texto: string;
  fuerte: boolean;
}

/** Una parte de la fórmula, entre dos «+». */
export type Ficha = Segmento[];

export type FormulaPartida =
  /** Sin «·» ni «+»: se muestra como texto, tal cual. */
  | { tipo: 'texto'; segmentos: Segmento[] }
  /** Un renglón por cada alternativa (separadas por «·») y una ficha por cada parte (separadas por «+»). */
  | { tipo: 'fichas'; renglones: Ficha[][] };

/** El texto en trozos normales y trozos `**fuertes**`. */
export function segmentos(texto: string): Segmento[] {
  return texto
    .split(/\*\*(.+?)\*\*/g)
    .map((p, i) => ({ texto: p, fuerte: i % 2 === 1 }))
    .filter((s) => s.texto !== '');
}

/** Parte por `separador` solo donde no hay negritas (un «+» dentro de `**…**` no separa nada). */
function partirFuera(texto: string, separador: string): string[] {
  const partes: string[] = [];
  let actual = '';
  let fuerte = false;
  for (let i = 0; i < texto.length; i++) {
    if (texto.startsWith('**', i)) {
      fuerte = !fuerte;
      actual += '**';
      i++;
    } else if (!fuerte && texto[i] === separador) {
      partes.push(actual);
      actual = '';
    } else {
      actual += texto[i];
    }
  }
  partes.push(actual);
  return partes.map((p) => p.trim()).filter((p) => p !== '');
}

/** La fórmula de un tema lista para dibujarse: fichas, o texto si no trae «·» ni «+». */
export function partirFormula(formula: string): FormulaPartida {
  if (!formula.includes('·') && !formula.includes('+')) {
    return { tipo: 'texto', segmentos: segmentos(formula) };
  }
  return {
    tipo: 'fichas',
    renglones: partirFuera(formula, '·').map((renglon) => partirFuera(renglon, '+').map(segmentos)),
  };
}

/** El nivel más alto que trae algún tema: cuántas barras tiene el medidor. */
export function nivelMaximo(temas: readonly { nivel: number }[]): number {
  return temas.reduce((m, t) => Math.max(m, t.nivel), 1);
}
