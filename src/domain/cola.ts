import type { ContentFilter } from '@/db/cola';
import type { Nivel } from '@/types';

/**
 * Cómo se arma una sesión de Study. Todo puro: la base solo entrega
 * candidatas y este archivo decide cuántas de cada tipo caben.
 *
 * Qué entra: las vencidas más atrasadas (SM-2 manda) y nuevas hasta el
 * límite de hoy. El tamaño es `metaDiaria`. Para que una cola larga no
 * bloquee lo nuevo, hasta NUEVAS_RESERVADAS lugares se guardan para nuevas
 * si aún queda cupo de nuevas hoy.
 *
 * En qué orden: cada sesión es distinta. Las nuevas salen de un sorteo
 * nuevo en cada sesión (`semillaDeSesion`), evitando las que quedaron sin
 * contestar la vez pasada, y las vencidas se barajan y se intercalan con
 * las nuevas (`intercalar`). El conteo de pendientes (HOY) no depende de
 * cuáles salgan: sale de countDue.
 */

export const NUEVAS_RESERVADAS = 3;

/**
 * Cuántas veces puede volver, en UNA sesión, una tarjeta FALLADA: una. Las
 * acertadas no vuelven, ni las que SM-2 deja en aprendizaje: vuelven mañana.
 *
 * Corrige el error en fresco sin hacer la sesión interminable. Reinsertar
 * también los pasos de aprendizaje (hasta 2 veces por tarjeta) llevaba una
 * sesión de 20 tarjetas a 40 o 55 respuestas.
 */
export const MAX_REINSERCIONES = 1;

/** Una tarjeta reinsertada vuelve entre 3 y 5 tarjetas después. */
export const REINSERCION_MIN = 3;
export const REINSERCION_MAX = 5;

/** Study ignora el filtro de nivel a propósito (ver useSessionStore); el modo limpio sí cuenta. */
export function filtroEstudio(f: ContentFilter): ContentFilter {
  return { modoLimpio: f.modoLimpio, niveles: [1, 2, 3] as Nivel[] };
}

/** Nuevas que todavía caben hoy. */
export function nuevasRestantesHoy(porDia: number, yaHoy: number): number {
  return Math.max(0, porDia - yaHoy);
}

/** Cuántas vencidas pedir: el tamaño menos los lugares reservados a nuevas. */
export function cupoVencidas(size: number, nuevasPosibles: number): number {
  return Math.max(0, size - Math.min(NUEVAS_RESERVADAS, nuevasPosibles));
}

/** Cuántas nuevas entran una vez traídas las vencidas: lo que sobre, sin pasar del cupo de hoy. */
export function cupoNuevas(size: number, vencidasTraidas: number, nuevasPosibles: number): number {
  return Math.max(0, Math.min(nuevasPosibles, size - vencidasTraidas));
}

/** Fisher-Yates con un azar inyectable (las pruebas lo fijan). Devuelve un arreglo nuevo. */
export function barajar<T>(xs: readonly T[], azar: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

/**
 * Las vencidas y las nuevas mezcladas: las vencidas en orden al azar y las nuevas repartidas
 * parejo entre ellas (no todas al final), empezando en un lugar al azar. Nunca sale dos veces el
 * mismo orden para las mismas tarjetas.
 */
export function intercalar<T>(vencidas: readonly T[], nuevas: readonly T[], azar: () => number = Math.random): T[] {
  const v = barajar(vencidas, azar);
  if (nuevas.length === 0) return v;
  if (v.length === 0) return [...nuevas];
  const total = v.length + nuevas.length;
  const paso = total / nuevas.length;
  const desfase = azar() * paso;
  const lugares = new Set(nuevas.map((_, i) => Math.min(total - 1, Math.floor(desfase + i * paso))));
  const out: T[] = [];
  let iv = 0;
  let in_ = 0;
  for (let i = 0; i < total; i++) {
    if ((lugares.has(i) && in_ < nuevas.length) || iv >= v.length) out.push(nuevas[in_++] as T);
    else out.push(v[iv++] as T);
  }
  return out;
}

/**
 * De las candidatas (ya en orden al azar), primero las que NO quedaron sin contestar en la sesión
 * anterior; esas van al final, así solo vuelven si no hay otras. Devuelve a lo más `n`.
 */
export function evitarRepetidas<T>(candidatas: readonly T[], idDe: (t: T) => number, excluir: ReadonlySet<number>, n: number): T[] {
  const frescas = candidatas.filter((c) => !excluir.has(idDe(c)));
  const repetidas = candidatas.filter((c) => excluir.has(idDe(c)));
  return [...frescas, ...repetidas].slice(0, Math.max(0, n));
}

/**
 * Arma la sesión: pide primero las nuevas que caben hoy (para saber cuántos
 * lugares reservar), luego las vencidas con el cupo que queda, y por último
 * recorta las nuevas a lo que sobra. Recibe cómo traer cada lista, así la
 * usa la store con la base y la prueba con SQLite en memoria.
 *
 * `excluir`: las nuevas que la sesión anterior mostró y no se contestaron. Se piden de más para
 * poder saltarlas, y solo entran si no hay otras.
 */
export async function armarSesion<T>(p: {
  size: number;
  nuevasPorDia: number;
  yaHoy: number;
  traerNuevas: (limite: number) => Promise<T[]>;
  traerVencidas: (limite: number) => Promise<T[]>;
  excluir?: ReadonlySet<number>;
  idDe?: (t: T) => number;
}): Promise<{ due: T[]; fresh: T[] }> {
  const quedan = nuevasRestantesHoy(p.nuevasPorDia, p.yaHoy);
  const excluir = p.idDe ? (p.excluir ?? new Set<number>()) : new Set<number>();
  const traidas = quedan > 0 ? await p.traerNuevas(quedan + excluir.size) : [];
  const candidatas = p.idDe ? evitarRepetidas(traidas, p.idDe, excluir, quedan) : traidas.slice(0, quedan);
  const due = await p.traerVencidas(cupoVencidas(p.size, candidatas.length));
  const fresh = candidatas.slice(0, cupoNuevas(p.size, due.length, candidatas.length));
  return { due, fresh };
}

