/**
 * Lo puro de Phrasal verbs: buscar un verbo, una partícula o un significado, dar nombre a las partículas repetidas
 * dentro de un verbo y decir lo que anuncia el lector de pantalla. Se prueba con `npm run check:ruleta` sobre las 207
 * formas reales.
 */

/** Lo que la búsqueda necesita de una forma. */
export interface FormaLista {
  id: number;
  particula: string;
  /** «get up», ya armado. */
  frase: string;
  significado: string;
}

export interface GrupoLista {
  verbo: string;
  ids: number[];
}

/** Un verbo que coincide con la búsqueda, con las formas que coinciden (ninguna si la búsqueda está vacía). */
export type GrupoBuscado<G extends GrupoLista> = G & { coinciden: number[] };

/** Sin mayúsculas, acentos ni signos, con un solo espacio entre palabras: la forma en que se compara todo. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Los verbos con alguna forma que coincide con la búsqueda, en su orden. Cada palabra de la búsqueda tiene que ser el
 * principio de alguna palabra de la frase o del significado de la forma («lev» y «up» encuentran «get up»: levantarse de
 * la cama). Una búsqueda vacía los devuelve todos.
 */
export function buscarGrupos<G extends GrupoLista>(
  grupos: readonly G[],
  porId: ReadonlyMap<number, FormaLista>,
  consulta: string
): GrupoBuscado<G>[] {
  const palabras = normalizar(consulta).split(' ').filter(Boolean);
  if (palabras.length === 0) return grupos.map((g) => ({ ...g, coinciden: [] }));
  const resultado: GrupoBuscado<G>[] = [];
  for (const g of grupos) {
    const coinciden = g.ids.filter((id) => {
      const f = porId.get(id);
      if (!f) return false;
      const pajar = normalizar(`${f.frase} ${f.significado}`).split(' ');
      return palabras.every((p) => pajar.some((w) => w.startsWith(p)));
    });
    if (coinciden.length > 0) resultado.push({ ...g, coinciden });
  }
  return resultado;
}

/**
 * El nombre de cada partícula de un verbo. Una que se repite (`check out` con dos significados) lleva su número: «out
 * (1)» y «out (2)», para que se distingan en la ruleta y en los chips.
 */
export function etiquetasParticulas(particulas: readonly string[]): string[] {
  const total = new Map<string, number>();
  for (const p of particulas) total.set(p, (total.get(p) ?? 0) + 1);
  const vistas = new Map<string, number>();
  return particulas.map((p) => {
    if ((total.get(p) ?? 0) < 2) return p;
    const n = (vistas.get(p) ?? 0) + 1;
    vistas.set(p, n);
    return `${p} (${n})`;
  });
}

/** Lo que oye el lector de pantalla al elegir una forma: «get up, levantarse de la cama, 1 de 14». */
export function anunciarForma(forma: { frase: string; significado: string }, indice: number, total: number): string {
  return `${forma.frase}, ${forma.significado}, ${indice + 1} de ${total}`;
}
