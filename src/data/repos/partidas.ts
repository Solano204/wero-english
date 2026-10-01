import { getDb } from '@/data/cliente';
import { correr, type Parte } from './lote';
import { dayKey } from '@/domain/fechas';
import type { AlternativaVoz, JuegoId, JuegoRecord, RetoSemanal, UsoModo } from '@/types';

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
export function parteRecords(usuarioId: number): Parte<Record<string, JuegoRecord>> {
  return {
    sql: `SELECT juego,
            COUNT(*)      AS partidas,
            MAX(aciertos) AS mejor,
            MAX(dia)      AS ultima
       FROM juego_log
      WHERE usuario_id = ?
      GROUP BY juego`,
    params: [usuarioId],
    columnas: ['juego', 'partidas', 'mejor', 'ultima'],
    leer: (filas) => recordsDe(filas as { juego: string; partidas: number; mejor: number; ultima: string | null }[]),
  };
}

export function getGameRecords(usuarioId: number): Promise<Record<string, JuegoRecord>> {
  return correr(parteRecords(usuarioId));
}

function recordsDe(
  rows: { juego: string; partidas: number; mejor: number; ultima: string | null }[]
): Record<string, JuegoRecord> {
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

/**
 * El reto semanal en una parte: cuenta aciertos de la sesión de estudio y de las partidas. Las dos formas de
 * practicar valen igual, que es justo lo que hace que el arcade no compita con el estudio.
 */
export function parteReto(usuarioId: number, meta: number = RETO_META, desde: string = lunesDe()): Parte<RetoSemanal> {
  return {
    sql: `SELECT (SELECT COALESCE(SUM(aciertos), 0) FROM sesion WHERE usuario_id = ? AND dia >= ?) AS s,
                 (SELECT COALESCE(SUM(aciertos), 0) FROM juego_log WHERE usuario_id = ? AND dia >= ?) AS j`,
    params: [usuarioId, desde, usuarioId, desde],
    columnas: ['s', 'j'],
    leer: (filas) => {
      const f = filas[0] as { s?: number; j?: number } | undefined;
      const llevas = (f?.s ?? 0) + (f?.j ?? 0);
      return { llevas, meta, desde, cumplido: llevas >= meta };
    },
  };
}

export function getRetoSemanal(usuarioId: number, meta: number = RETO_META): Promise<RetoSemanal> {
  return correr(parteReto(usuarioId, meta));
}

/* ============================================================
   Registro de pronunciación
   ============================================================ */

/** Un intento de «Di la palabra»: lo que decidió, lo que se entendió y todas las alternativas del reconocedor. */
export async function logHabla(
  usuarioId: number,
  parId: string,
  objetivo: string,
  veredicto: 'acierto' | 'confusa' | 'no_entendi',
  oido: string | null,
  alternativas: AlternativaVoz[]
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO habla_log (usuario_id, par_id, objetivo, oido, acierto, creado_en, alternativas, veredicto)
     VALUES (?,?,?,?,?,?,?,?);`,
    [
      usuarioId,
      parId,
      objetivo,
      oido,
      veredicto === 'acierto' ? 1 : 0,
      Date.now(),
      JSON.stringify(alternativas),
      veredicto,
    ]
  );
}

/** Las filas que cuentan en los resúmenes: un «no te entendí» no es un intento fallido de quien habla. */
const HABLA_CUENTA = "(veredicto IS NULL OR veredicto <> 'no_entendi')";

/** Cuántos pares mínimos ha acertado al menos una vez. Para el arcade. */
export function parteHabla(usuarioId: number): Parte<{ intentos: number; dominados: number }> {
  return {
    sql: `SELECT COUNT(*) AS intentos,
            COUNT(DISTINCT CASE WHEN acierto = 1 THEN par_id END) AS dominados
       FROM habla_log WHERE usuario_id = ? AND ${HABLA_CUENTA}`,
    params: [usuarioId],
    columnas: ['intentos', 'dominados'],
    leer: (filas) => {
      const row = filas[0] as { intentos?: number; dominados?: number } | undefined;
      return { intentos: row?.intentos ?? 0, dominados: row?.dominados ?? 0 };
    },
  };
}

export function getHablaResumen(usuarioId: number): Promise<{ intentos: number; dominados: number }> {
  return correr(parteHabla(usuarioId));
}

/**
 * Uso de cada modo con registro, sin tablas nuevas: las partidas salen de
 * `juego_log`, las sesiones de estudio de `sesion` y "Di la palabra" de
 * `habla_log`. Los modos que no dejan registro (gramática, lecturas, oído…)
 * no aparecen.
 */
export function parteUso(usuarioId: number): Parte<Record<string, UsoModo>> {
  return {
    sql: `SELECT juego AS modo, COUNT(DISTINCT dia) AS dias, MAX(jugado_en) AS ultimo
       FROM juego_log WHERE usuario_id = ? GROUP BY juego
     UNION ALL
     SELECT 'study', COUNT(DISTINCT dia), MAX(inicio)
       FROM sesion WHERE usuario_id = ?
     UNION ALL
     SELECT 'pares_minimos',
            COUNT(DISTINCT date(creado_en / 1000, 'unixepoch', 'localtime')),
            MAX(creado_en)
       FROM habla_log WHERE usuario_id = ? AND ${HABLA_CUENTA}`,
    params: [usuarioId, usuarioId, usuarioId],
    columnas: ['modo', 'dias', 'ultimo'],
    leer: (filas) => usoDe(filas as { modo: string; dias: number; ultimo: number | null }[]),
  };
}

export function getUsoModos(usuarioId: number): Promise<Record<string, UsoModo>> {
  return correr(parteUso(usuarioId));
}

function usoDe(rows: { modo: string; dias: number; ultimo: number | null }[]): Record<string, UsoModo> {
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
