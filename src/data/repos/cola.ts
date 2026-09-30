import { addDays, dayKey, startOfDay } from '@/domain/fechas';
import type { CardState, ContentFilter } from '@/types';
import { ORDEN_NUEVAS, type OrdenNuevas } from '@/config/aprendizaje';

/**
 * La cola de repaso como SQL puro, sin nada de Expo, para que la misma
 * consulta que corre en el teléfono se pruebe en Node (scripts/check-srs.mjs).
 */

export interface Fragment {
  sql: string;
  args: (string | number)[];
}

/** Todas las consultas de contenido pasan por aquí: modo limpio, nivel, pack y mundo. */
export function buildFilter(f: ContentFilter): Fragment {
  const parts: string[] = ['e.is_canonical = 1', 'e.revisar = 0'];
  const args: (string | number)[] = [];

  if (f.modoLimpio) parts.push('e.vulgaridad = 0');

  if (f.niveles.length > 0 && f.niveles.length < 3) {
    parts.push(`e.nivel IN (${f.niveles.map(() => '?').join(',')})`);
    args.push(...f.niveles);
  }

  if (f.packs && f.packs.length > 0) {
    parts.push(`e.pack_final IN (${f.packs.map(() => '?').join(',')})`);
    args.push(...f.packs);
  }

  if (f.mundos && f.mundos.length > 0) {
    parts.push(`e.mundo IN (${f.mundos.map(() => '?').join(',')})`);
    args.push(...f.mundos);
  }

  return { sql: parts.join(' AND '), args };
}

/**
 * Una tarjeta está VENCIDA si:
 *  - ya se repasó alguna vez (`ultimo_repaso`). Una favorita que nunca se
 *    estudió tiene fila con `vence_en = 0`, pero no tiene turno: es nueva;
 *  - su fecha ya llegó (`vence_en <= ahora`);
 *  - no es una tarjeta en aprendizaje (`intervalo = 0`) respondida hoy. Los
 *    pasos de 1 y 10 min de SM-2 no se repiten en la sesión (el motor solo
 *    reinserta una vez las FALLADAS): lo demás vuelve mañana.
 *
 * Parámetros, en orden: ahora, inicio del día local.
 */
export const SQL_VENCIDA =
  't.ultimo_repaso IS NOT NULL AND t.vence_en <= ? AND NOT (t.intervalo = 0 AND t.ultimo_repaso >= ?)';

const SIN_REGLAS = "e.tipo != 'regla_fonetica'";

/** Params: usuario, ...filtro.args, ahora, inicioDelDia. */
function sqlContarVencidas(filtro: string): string {
  return `SELECT COUNT(*) AS n
       FROM entrada e
       JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE ${filtro} AND ${SQL_VENCIDA} AND ${SIN_REGLAS};`;
}

/** Las más atrasadas primero. Params: usuario, ...filtro.args, ahora, inicioDelDia, límite. */
function sqlVencidas(filtro: string): string {
  return `SELECT e.*, t.repeticiones, t.intervalo, t.facilidad,
            t.vence_en, t.ultimo_repaso, t.fallos, t.aciertos,
            t.dominada, t.favorito
       FROM entrada e
       JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE ${filtro} AND ${SQL_VENCIDA} AND ${SIN_REGLAS}
      ORDER BY t.vence_en ASC, e.id ASC
      LIMIT ?;`;
}

/**
 * El orden de las frases nuevas, propio de cada usuario.
 *
 * Antes era `ORDER BY e.nivel, e.id`: el mismo para todos, así que dos personas nuevas
 * estudiaban exactamente las mismas frases en el mismo orden. Ahora cada frase recibe una llave
 * en dos pasos, todo con enteros de SQLite (sin funciones extra):
 *
 *  1. `k0 = (id · m + c) mod P`, con P = 4 294 967 291 (el primo más grande debajo de 2^32) y
 *     `m`, `c` sacados de la semilla del usuario (`usuario.semilla`). Como la semilla
 *     MULTIPLICA, cada usuario tiene una permutación distinta; si solo se sumara, todos tendrían
 *     el mismo orden empezando en otro punto (una rotación) y compartirían tramos enteros.
 *  2. `llave = mezcla(k0)`: el mezclador de 32 bits «xorshift-multiplica» (x ^= x >> 16;
 *     x *= 0x45d9f3b; dos veces y un último x ^= x >> 16). Sin este paso el orden sale en
 *     escalera (ids que avanzan de 574 en 574, por ejemplo): distinto por usuario, pero nada
 *     al azar. SQLite no tiene XOR, así que `a ^ b` se escribe `(a | b) - (a & b)`.
 *
 * Las dos partes son biyecciones, así que nunca hay empates. Es estable: la misma semilla da
 * siempre el mismo orden, y los conteos de Hoy, las pendientes y la sesión no se descuadran.
 * Nada se sale de los 64 bits: id · m + c < 2^53 y x (< 2^32) · 0x45d9f3b (< 2^27) < 2^59.
 */
export const PRIMO_ORDEN = 4294967291;
const MEZCLA = 0x45d9f3b;
const MASCARA_32 = 4294967295;

/** Mezcla de 32 bits (la de MurmurHash3): semillas parecidas dan números nada parecidos. */
function mezclar32(x: number): number {
  let h = x >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Multiplicador y suma del orden de un usuario. `m` nunca es chico (≥ 2^16): con m = 1 el paso
 * lineal sería el orden de los ids.
 */
export function ordenDeSemilla(semilla: number): { m: number; c: number } {
  const s = Math.trunc(Math.abs(semilla)) >>> 0;
  const m = 65537 + (mezclar32(s) % (PRIMO_ORDEN - 65537));
  const c = mezclar32(s ^ 0x9e3779b9) % PRIMO_ORDEN;
  return { m, c };
}

/**
 * La semilla de UNA sesión: la del usuario mezclada con una sal al azar que se saca al armar cada
 * sesión (expo-crypto). Así cada vez que se entra a Estudiar las frases nuevas salen en otro orden
 * (y otras, porque la sesión toma solo las primeras), y dos usuarios nunca comparten orden: la
 * semilla del usuario sigue siendo parte de la mezcla.
 */
export function semillaDeSesion(semillaUsuario: number, sal: number): number {
  const u = Math.trunc(Math.abs(semillaUsuario)) >>> 0;
  return mezclar32((u ^ mezclar32(Math.trunc(Math.abs(sal)) >>> 0)) >>> 0);
}

/** `x ^ (x >> 16)` para un entero de 32 bits, sin operador XOR: (a | b) - (a & b). */
function xorCorrido(x: string): string {
  return `(((${x} >> 16) | ${x}) - ((${x} >> 16) & ${x}))`;
}

/**
 * Frases sin turno: sin fila en `tarjeta` o con fila que nunca se repasó (una favorita), en el
 * orden propio del usuario (ver arriba). Cada paso de la mezcla va en su propia subconsulta para
 * que SQLite calcule cada valor una vez. Params: m, c, usuario, ...filtro.args, límite.
 */
function sqlNuevas(filtro: string, orden: OrdenNuevas): string {
  const porNivel = orden === 'aleatorio_por_nivel' ? 'n2.nivel ASC, ' : '';
  return `SELECT * FROM (
       SELECT n1.*, ((${xorCorrido('n1.k1')} * ${MEZCLA}) & ${MASCARA_32}) AS k2 FROM (
         SELECT n0.*, ((${xorCorrido('n0.k0')} * ${MEZCLA}) & ${MASCARA_32}) AS k1 FROM (
           SELECT e.*, NULL AS repeticiones, NULL AS intervalo,
                  NULL AS facilidad, NULL AS vence_en, NULL AS ultimo_repaso,
                  NULL AS fallos, NULL AS aciertos, NULL AS dominada,
                  t.favorito AS favorito,
                  ((e.id * ? + ?) % ${PRIMO_ORDEN}) AS k0
             FROM entrada e
             LEFT JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
            WHERE ${filtro}
              AND (t.entry_id IS NULL OR t.ultimo_repaso IS NULL)
              AND ${SIN_REGLAS}
         ) n0
       ) n1
     ) n2
     ORDER BY ${porNivel}${xorCorrido('n2.k2')} ASC, n2.id ASC
     LIMIT ?;`;
}

/**
 * Vencidas, de aprendizaje (las vencidas con `intervalo = 0`) y fantasma
 * (fila sin repasar). Params: ahora, inicioDelDia, ahora, inicioDelDia,
 * usuario, ...filtro.args.
 */
function sqlDiagnosticoCola(filtro: string): string {
  return `SELECT
            COALESCE(SUM(CASE WHEN ${SQL_VENCIDA} THEN 1 ELSE 0 END), 0) AS vencidas,
            COALESCE(SUM(CASE WHEN ${SQL_VENCIDA} AND t.intervalo = 0 THEN 1 ELSE 0 END), 0) AS aprendizaje,
            COALESCE(SUM(CASE WHEN t.ultimo_repaso IS NULL THEN 1 ELSE 0 END), 0) AS fantasma
       FROM entrada e
       JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE ${filtro} AND ${SIN_REGLAS};`;
}

export const SQL_UPSERT_TARJETA = `INSERT INTO tarjeta
       (usuario_id, entry_id, repeticiones, intervalo, facilidad,
        vence_en, ultimo_repaso, fallos, aciertos, dominada, favorito)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(usuario_id, entry_id) DO UPDATE SET
       repeticiones = excluded.repeticiones,
       intervalo    = excluded.intervalo,
       facilidad    = excluded.facilidad,
       vence_en     = excluded.vence_en,
       ultimo_repaso= excluded.ultimo_repaso,
       fallos       = excluded.fallos,
       aciertos     = excluded.aciertos,
       dominada     = excluded.dominada;`;

export function paramsUpsertTarjeta(usuarioId: number, s: CardState): (number | null)[] {
  return [
    usuarioId, s.entry_id, s.repeticiones, s.intervalo, s.facilidad,
    s.vence_en, s.ultimo_repaso, s.fallos, s.aciertos, s.dominada, s.favorito,
  ];
}

/**
 * Nuevas que ya entraron hoy: `sesion.nuevas` de las sesiones del día local.
 * No cuenta las que entran por juegos. Params: usuario, dayKey (YYYY-MM-DD).
 */
const SQL_NUEVAS_HOY =
  'SELECT COALESCE(SUM(nuevas), 0) AS n FROM sesion WHERE usuario_id = ? AND dia = ?;';

/**
 * Cada consulta de la cola sale de aquí con su SQL Y sus parámetros, en el
 * orden en que aparecen los `?`. queries.ts las ejecuta tal cual y
 * scripts/check-srs.mjs las prueba tal cual: si el orden cambia, la prueba
 * lo ve. Nadie más arma parámetros a mano.
 */
export interface Consulta {
  sql: string;
  params: (string | number)[];
}

/** Cuántas tarjetas están vencidas (ver SQL_VENCIDA). */
export function consultaContarVencidas(usuarioId: number, filter: ContentFilter, now: number): Consulta {
  const f = buildFilter(filter);
  return { sql: sqlContarVencidas(f.sql), params: [usuarioId, ...f.args, now, startOfDay(now)] };
}

/**
 * Frases y dominadas por mundo, contadas sobre el MISMO filtro de contenido (Modo Limpio,
 * niveles, packs): así el «N de M» de un mundo nunca tiene más dominadas que frases.
 */
export function consultaProgresoPorMundo(usuarioId: number, filter: ContentFilter): Consulta {
  const f = buildFilter(filter);
  return {
    sql: `SELECT e.mundo AS mundo,
                 COUNT(*) AS total,
                 COALESCE(SUM(CASE WHEN t.dominada = 1 THEN 1 ELSE 0 END), 0) AS dominadas
            FROM entrada e
            LEFT JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
           WHERE ${f.sql}
           GROUP BY e.mundo;`,
    params: [usuarioId, ...f.args],
  };
}

/** Las vencidas más atrasadas, hasta `limite`. */
export function consultaVencidas(usuarioId: number, filter: ContentFilter, limite: number, now: number): Consulta {
  const f = buildFilter(filter);
  return { sql: sqlVencidas(f.sql), params: [usuarioId, ...f.args, now, startOfDay(now), limite] };
}

/** Frases sin turno, hasta `limite`, en el orden propio del usuario (su `semilla`). */
export function consultaNuevas(
  usuarioId: number,
  semilla: number,
  filter: ContentFilter,
  limite: number,
  orden: OrdenNuevas = ORDEN_NUEVAS
): Consulta {
  const f = buildFilter(filter);
  const { m, c } = ordenDeSemilla(semilla);
  return { sql: sqlNuevas(f.sql, orden), params: [m, c, usuarioId, ...f.args, limite] };
}

/**
 * Cuántas frases nuevas quedan en el catálogo con este filtro (sin límite de hoy): para decir
 * «ya viste todas» cuando es cierto y no ofrecer aprender nuevas si no hay.
 */
export function consultaContarNuevas(usuarioId: number, filter: ContentFilter): Consulta {
  const f = buildFilter(filter);
  return {
    sql: `SELECT COUNT(*) AS n
            FROM entrada e
            LEFT JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
           WHERE ${f.sql}
             AND (t.entry_id IS NULL OR t.ultimo_repaso IS NULL)
             AND ${SIN_REGLAS};`,
    params: [usuarioId, ...f.args],
  };
}

/**
 * Cuándo vuelve el próximo repaso (ms epoch), o null si no hay ninguno programado. Solo cuenta las
 * que NO están vencidas ahora. Una de aprendizaje contestada hoy (intervalo 0: la fallada) no
 * vuelve hasta mañana aunque su `vence_en` sea en minutos (ver SQL_VENCIDA), así que cuenta como
 * mañana. Params: inicioDelDia, inicioDeMañana, usuario, ...filtro.args, ahora, inicioDelDia.
 */
export function consultaProximoRepaso(usuarioId: number, filter: ContentFilter, now: number): Consulta {
  const f = buildFilter(filter);
  const hoy = startOfDay(now);
  const manana = startOfDay(addDays(now, 1));
  return {
    sql: `SELECT MIN(CASE WHEN t.intervalo = 0 AND t.ultimo_repaso >= ? THEN ? ELSE t.vence_en END) AS proximo
            FROM entrada e
            JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
           WHERE ${f.sql}
             AND t.ultimo_repaso IS NOT NULL
             AND NOT (${SQL_VENCIDA})
             AND ${SIN_REGLAS};`,
    params: [hoy, manana, usuarioId, ...f.args, now, hoy],
  };
}

/** Vencidas / de aprendizaje / fantasma. */
export function consultaDiagnosticoCola(usuarioId: number, filter: ContentFilter, now: number): Consulta {
  const f = buildFilter(filter);
  const inicio = startOfDay(now);
  return { sql: sqlDiagnosticoCola(f.sql), params: [now, inicio, now, inicio, usuarioId, ...f.args] };
}

/** Nuevas que ya entraron hoy (día local). */
export function consultaNuevasHoy(usuarioId: number, now: number): Consulta {
  return { sql: SQL_NUEVAS_HOY, params: [usuarioId, dayKey(now)] };
}

