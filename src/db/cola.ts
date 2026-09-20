import { dayKey, startOfDay } from '@/utils/date';
import type { CardState, Nivel } from '@/types';

/**
 * La cola de repaso como SQL puro, sin nada de Expo, para que la misma
 * consulta que corre en el teléfono se pruebe en Node (scripts/check-srs.mjs).
 */

export interface ContentFilter {
  modoLimpio: boolean;
  niveles: Nivel[];
  packs?: string[];
  mundos?: string[];
}

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
 * Frases sin turno: sin fila en `tarjeta` o con fila que nunca se repasó
 * (una favorita). Por nivel y luego id. Params: usuario, ...filtro.args, límite.
 */
function sqlNuevas(filtro: string): string {
  return `SELECT e.*, NULL AS repeticiones, NULL AS intervalo,
            NULL AS facilidad, NULL AS vence_en, NULL AS ultimo_repaso,
            NULL AS fallos, NULL AS aciertos, NULL AS dominada,
            t.favorito AS favorito
       FROM entrada e
       LEFT JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE ${filtro}
        AND (t.entry_id IS NULL OR t.ultimo_repaso IS NULL)
        AND ${SIN_REGLAS}
      ORDER BY e.nivel ASC, e.id ASC
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

/** Las vencidas más atrasadas, hasta `limite`. */
export function consultaVencidas(usuarioId: number, filter: ContentFilter, limite: number, now: number): Consulta {
  const f = buildFilter(filter);
  return { sql: sqlVencidas(f.sql), params: [usuarioId, ...f.args, now, startOfDay(now), limite] };
}

/** Frases sin turno, hasta `limite`. */
export function consultaNuevas(usuarioId: number, filter: ContentFilter, limite: number): Consulta {
  const f = buildFilter(filter);
  return { sql: sqlNuevas(f.sql), params: [usuarioId, ...f.args, limite] };
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

