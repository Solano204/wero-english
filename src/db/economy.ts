import { getDb } from './client';
import { dayKey } from '@/utils/date';
import type { JuegoId, JuegoRecord, RetoSemanal, UsoModo } from '@/types';

/**
 * Registro de partidas, reto semanal y pronunciación.
 *
 * Aquí vivía la economía de monedas. Se quitó entera: la moneda no
 * compraba nada que importara, y para sostenerla había que enseñar un
 * saldo, una colección y unos cosméticos que llenaban de números unas
 * pantallas cuyo único trabajo es decir cómo te fue.
 *
 * Las pistas ahora vienen con el nivel, que es más simple y más justo:
 * el nivel 3 te da tres y el 150 no te da ninguna, y eso se lee de un
 * vistazo sin tener que entender una divisa.
 */

/** Aciertos semanales del reto. No hay reloj y no se puede perder. */
export const RETO_META = 40;

/* ============================================================
   Registro de partidas
   ============================================================ */

export async function logGame(
  usuarioId: number,
  juego: JuegoId,
  rondas: number,
  aciertos: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO juego_log (usuario_id, juego, dia, rondas, aciertos, jugado_en)
     VALUES (?,?,?,?,?,?);`,
    [usuarioId, juego, dayKey(), rondas, aciertos, Date.now()]
  );
}

/** El mejor puntaje propio y cuántas partidas lleva, por juego. */
export async function getGameRecords(
  usuarioId: number
): Promise<Record<string, JuegoRecord>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    juego: string;
    partidas: number;
    mejor: number;
    ultima: string | null;
  }>(
    `SELECT juego,
            COUNT(*)      AS partidas,
            MAX(aciertos) AS mejor,
            MAX(dia)      AS ultima
       FROM juego_log
      WHERE usuario_id = ?
      GROUP BY juego;`,
    [usuarioId]
  );

  const out: Record<string, JuegoRecord> = {};
  for (const r of rows) {
    out[r.juego] = {
      juego: r.juego as JuegoId,
      partidas: r.partidas,
      mejor: r.mejor ?? 0,
      ultimaFecha: r.ultima,
    };
  }
  return out;
}

/* ============================================================
   Reto de la semana

   Es la alternativa al torneo con cuenta regresiva de la competencia:
   una meta contra uno mismo, sin ranking, sin servidor y sin reloj que
   pueda vencerse en contra. Si la semana termina corta, la app no dice
   nada y empieza otra.
   ============================================================ */

/** Lunes de la semana que contiene ts, en clave YYYY-MM-DD. */
export function lunesDe(ts: number = Date.now()): string {
  const d = new Date(ts);
  const dow = d.getDay(); // 0 domingo
  const retroceso = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - retroceso);
  d.setHours(0, 0, 0, 0);
  return dayKey(d.getTime());
}

export async function getRetoSemanal(
  usuarioId: number,
  meta: number = RETO_META
): Promise<RetoSemanal> {
  const db = await getDb();
  const desde = lunesDe();

  // Cuenta aciertos de la sesión de estudio y de las partidas: las dos
  // formas de practicar valen igual, que es justo lo que hace que el
  // arcade no compita con el estudio.
  const s = await db.getFirstAsync<{ n: number }>(
    'SELECT COALESCE(SUM(aciertos), 0) AS n FROM sesion WHERE usuario_id = ? AND dia >= ?;',
    [usuarioId, desde]
  );
  const j = await db.getFirstAsync<{ n: number }>(
    'SELECT COALESCE(SUM(aciertos), 0) AS n FROM juego_log WHERE usuario_id = ? AND dia >= ?;',
    [usuarioId, desde]
  );

  const llevas = (s?.n ?? 0) + (j?.n ?? 0);
  return { llevas, meta, desde, cumplido: llevas >= meta };
}

/* ============================================================
   Registro de pronunciación
   ============================================================ */

export async function logHabla(
  usuarioId: number,
  parId: string,
  objetivo: string,
  oido: string | null,
  acierto: boolean
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO habla_log (usuario_id, par_id, objetivo, oido, acierto, creado_en)
     VALUES (?,?,?,?,?,?);`,
    [usuarioId, parId, objetivo, oido, acierto ? 1 : 0, Date.now()]
  );
}

/** Cuántos pares mínimos ha acertado al menos una vez. Para el arcade. */
export async function getHablaResumen(
  usuarioId: number
): Promise<{ intentos: number; dominados: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ intentos: number; dominados: number }>(
    `SELECT COUNT(*) AS intentos,
            COUNT(DISTINCT CASE WHEN acierto = 1 THEN par_id END) AS dominados
       FROM habla_log WHERE usuario_id = ?;`,
    [usuarioId]
  );
  return {
    intentos: row?.intentos ?? 0,
    dominados: row?.dominados ?? 0,
  };
}

/**
 * Uso de cada modo con registro, sin tablas nuevas: las partidas salen de
 * `juego_log`, las sesiones de estudio de `sesion` y "Di la palabra" de
 * `habla_log`. Los modos que no dejan registro (gramática, lecturas, oído…)
 * no aparecen.
 */
export async function getUsoModos(
  usuarioId: number
): Promise<Record<string, UsoModo>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    modo: string;
    dias: number;
    ultimo: number | null;
  }>(
    `SELECT juego AS modo, COUNT(DISTINCT dia) AS dias, MAX(jugado_en) AS ultimo
       FROM juego_log WHERE usuario_id = ? GROUP BY juego
     UNION ALL
     SELECT 'study', COUNT(DISTINCT dia), MAX(inicio)
       FROM sesion WHERE usuario_id = ?
     UNION ALL
     SELECT 'pares_minimos',
            COUNT(DISTINCT date(creado_en / 1000, 'unixepoch', 'localtime')),
            MAX(creado_en)
       FROM habla_log WHERE usuario_id = ?;`,
    [usuarioId, usuarioId, usuarioId]
  );

  const out: Record<string, UsoModo> = {};
  for (const r of rows) {
    if (r.ultimo === null) continue;
    const previo = out[r.modo];
    out[r.modo] = {
      dias: (previo?.dias ?? 0) + r.dias,
      ultimo: Math.max(previo?.ultimo ?? 0, r.ultimo),
    };
  }
  return out;
}
