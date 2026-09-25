/**
 * El mapa de niveles como datos: qué estado tiene cada nivel, cómo se agrupan en
 * tramos, cuánto mide cada renglón de la lista y qué estrellas son nuevas. Módulo
 * puro (`npm run check:niveles`): no toca la base ni la pantalla, y no cambia la
 * lógica de desbloqueo, de anuncios ni de estrellas; solo la lee.
 *
 * La regla, tal como la deja `db/levels.ts`: `siguiente` es el nivel más alto jugado
 * más uno. Un nivel está abierto si `n < siguiente` o si se pagó con un anuncio; el
 * `siguiente` es el actual; y un anuncio abre UN solo nivel adelantado: el
 * `siguiente + 1`.
 */

export const COLUMNAS = 5;

export type EstadoNivel = 'perfecto' | 'hecho' | 'abierto' | 'actual' | 'anuncio' | 'bloqueado';
export type EstadoTramo = 'abierto' | 'completo' | 'bloqueado';

export interface ContextoNiveles {
  /** Cuántos niveles tiene el juego (200). */
  total: number;
  /** El nivel más alto jugado más uno. */
  siguiente: number;
  /** Niveles abiertos con anuncio (además de los jugados). */
  pagados: ReadonlySet<number>;
  /** Estrellas por nivel; sin fila, sin estrellas. */
  estrellas: ReadonlyMap<number, number>;
}

export interface BandaDef {
  id: string;
  nombre: string;
  desde: number;
  hasta: number;
  /** Cuántas frases tiene la banda. */
  frases: number;
}

export interface NivelVista {
  n: number;
  estado: EstadoNivel;
  estrellas: number;
}

export interface Tramo {
  id: string;
  nombre: string;
  desde: number;
  hasta: number;
  frases: number;
  /** Estrellas ganadas en el tramo y las que caben (3 por nivel). */
  estrellas: number;
  maximo: number;
  estado: EstadoTramo;
  niveles: NivelVista[];
}

/** El estado de un nivel: cada uno se reconoce por forma o ícono, no solo por color. */
export function estadoNivel(n: number, c: ContextoNiveles): EstadoNivel {
  if (n === c.siguiente && n <= c.total) return 'actual';
  if (n < c.siguiente || c.pagados.has(n)) {
    const estrellas = c.estrellas.get(n) ?? 0;
    if (estrellas >= 3) return 'perfecto';
    return estrellas > 0 ? 'hecho' : 'abierto';
  }
  if (n === c.siguiente + 1 && n <= c.total) return 'anuncio';
  return 'bloqueado';
}

/**
 * Las bandas como tramos. Completo: todos sus niveles con las tres estrellas.
 * Bloqueado: ninguno se puede jugar ni abrir con anuncio todavía (su primer nivel se
 * abre al terminar el anterior). Abierto: el resto.
 */
export function armarTramos(bandas: readonly BandaDef[], c: ContextoNiveles): Tramo[] {
  return bandas.map((b) => {
    const niveles: NivelVista[] = [];
    let estrellas = 0;
    for (let n = b.desde; n <= b.hasta; n++) {
      const e = c.estrellas.get(n) ?? 0;
      niveles.push({ n, estado: estadoNivel(n, c), estrellas: e });
      estrellas += Math.min(3, e);
    }
    const todosBloqueados = niveles.every((v) => v.estado === 'bloqueado');
    const perfecto = niveles.length > 0 && niveles.every((v) => v.estado === 'perfecto');
    const estado: EstadoTramo = todosBloqueados ? 'bloqueado' : perfecto ? 'completo' : 'abierto';
    return { id: b.id, nombre: b.nombre, desde: b.desde, hasta: b.hasta, frases: b.frases, estrellas, maximo: niveles.length * 3, estado, niveles };
  });
}

export interface ItemTramo {
  tipo: 'tramo';
  key: string;
  tramo: Tramo;
  /** Sus renglones están a la vista (un tramo completo solo, si se expandió). */
  expandido: boolean;
}

export interface ItemFila {
  tipo: 'fila';
  key: string;
  niveles: NivelVista[];
  /** Posición del renglón entre todos los renglones de la lista: escalona la entrada. */
  fila: number;
}

export type ItemLista = ItemTramo | ItemFila;

/**
 * La lista plana que pinta la pantalla: un encabezado por tramo y, debajo, sus
 * renglones de `COLUMNAS` niveles. Un tramo bloqueado queda en su encabezado y uno
 * completo también, salvo que se haya expandido.
 */
export function aplanar(tramos: readonly Tramo[], expandidos: ReadonlySet<string>): ItemLista[] {
  const items: ItemLista[] = [];
  let fila = 0;
  for (const tramo of tramos) {
    const conFilas = tramo.estado === 'abierto' || (tramo.estado === 'completo' && expandidos.has(tramo.id));
    items.push({ tipo: 'tramo', key: `tramo-${tramo.id}`, tramo, expandido: conFilas });
    if (!conFilas) continue;
    for (let i = 0; i < tramo.niveles.length; i += COLUMNAS) {
      const niveles = tramo.niveles.slice(i, i + COLUMNAS);
      items.push({ tipo: 'fila', key: `fila-${tramo.id}-${niveles[0]?.n ?? i}`, niveles, fila: fila++ });
    }
  }
  return items;
}

/** Los índices de los encabezados: los que se quedan pegados arriba. */
export function indicesEncabezado(items: readonly ItemLista[]): number[] {
  const indices: number[] = [];
  items.forEach((it, i) => {
    if (it.tipo === 'tramo') indices.push(i);
  });
  return indices;
}

export interface Medidas {
  offsets: number[];
  alturas: number[];
  /** Alto de todos los ítems juntos. */
  largo: number;
}

/** Dónde empieza cada ítem y cuánto mide, para `getItemLayout` y para calcular el scroll. */
export function medir(items: readonly ItemLista[], altoTramo: number, altoFila: number): Medidas {
  const offsets: number[] = [];
  const alturas: number[] = [];
  let y = 0;
  for (const it of items) {
    const alto = it.tipo === 'tramo' ? altoTramo : altoFila;
    offsets.push(y);
    alturas.push(alto);
    y += alto;
  }
  return { offsets, alturas, largo: y };
}

/** El índice del renglón donde está el nivel `n`, o -1 si no está a la vista (tramo plegado o bloqueado). */
export function indiceDeNivel(items: readonly ItemLista[], n: number): number {
  return items.findIndex((it) => it.tipo === 'fila' && it.niveles.some((v) => v.n === n));
}

/**
 * El scroll que deja el ítem `indice` centrado en lo que se ve. El encabezado pegado
 * ocupa `reservado` arriba, así que el centro se calcula sobre lo que queda debajo.
 */
export function offsetCentrado(m: Medidas, indice: number, viewport: number, reservado: number): number {
  const arriba = m.offsets[indice];
  const alto = m.alturas[indice];
  if (arriba === undefined || alto === undefined) return 0;
  const centro = arriba + alto / 2 - (viewport + reservado) / 2;
  return Math.min(Math.max(0, centro), Math.max(0, m.largo - viewport));
}

export interface EstrellaNueva {
  nivel: number;
  antes: number;
  ahora: number;
}

/**
 * Qué niveles ganaron estrellas desde la última foto. Sin foto previa (primera vez que
 * se ve el mapa en esta sesión) no hay nada que celebrar. Las estrellas solo suben, así
 * que nunca devuelve una baja.
 */
export function estrellasNuevas(
  previo: ReadonlyMap<number, number> | null | undefined,
  actual: ReadonlyMap<number, number>
): EstrellaNueva[] {
  if (!previo) return [];
  const nuevas: EstrellaNueva[] = [];
  for (const [nivel, ahora] of actual) {
    const antes = previo.get(nivel) ?? 0;
    if (ahora > antes) nuevas.push({ nivel, antes, ahora });
  }
  return nuevas.sort((a, b) => a.nivel - b.nivel);
}

export function totalEstrellas(estrellas: ReadonlyMap<number, number>): number {
  let total = 0;
  for (const e of estrellas.values()) total += e;
  return total;
}

export const tituloTramo = (t: Pick<Tramo, 'desde' | 'hasta'>) => `Niveles ${t.desde}–${t.hasta}`;

/** Lo que dice un tramo bloqueado: la regla real, que es por nivel. */
export const avisoBloqueo = (t: Pick<Tramo, 'desde'>) => `Se abre al terminar el nivel ${t.desde - 1}`;

/** Lo que anuncia el lector de pantalla de una celda. */
export function etiquetaNivel(n: number, estado: EstadoNivel, estrellas: number): string {
  if (estado === 'actual') return `Nivel ${n}, el que sigue`;
  if (estado === 'anuncio') return `Nivel ${n}, se abre con un anuncio`;
  if (estado === 'bloqueado') return `Nivel ${n}, bloqueado`;
  return `Nivel ${n}, ${Math.min(3, estrellas)} de 3 estrellas`;
}
