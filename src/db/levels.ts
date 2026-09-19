import { getDb } from './client';
import type { JuegoId } from '@/types';

/**
 * Progreso por nivel.
 *
 * Solo existe fila para los niveles ya jugados. Con ochocientos niveles,
 * prellenar la tabla haría que cada usuario nuevo escribiera ochocientas
 * filas antes de ver la primera pantalla. Un nivel sin fila es un nivel
 * sin jugar, y eso basta.
 */

export interface NivelEstado {
  nivel: number;
  estrellas: number;
  mejor: number;
  intentos: number;
}

export async function getNiveles(
  usuarioId: number,
  juego: JuegoId
): Promise<Map<number, NivelEstado>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    nivel: number;
    estrellas: number;
    mejor: number;
    intentos: number;
  }>(
    'SELECT nivel, estrellas, mejor, intentos FROM nivel_juego WHERE usuario_id = ? AND juego = ?;',
    [usuarioId, juego]
  );

  const out = new Map<number, NivelEstado>();
  for (const r of rows) out.set(r.nivel, r);
  return out;
}

/**
 * Guarda el resultado de un nivel.
 *
 * Las estrellas y el mejor puntaje solo suben. Rejugar un nivel para
 * intentar las tres estrellas nunca puede dejarte peor que antes: si eso
 * pasara, el usuario dejaría de rejugar, que es justo lo contrario de
 * para qué sirven las estrellas.
 */
/** Niveles abiertos con anuncio y todavía sin jugar. */
export async function nivelesPagados(
  usuarioId: number,
  juego: JuegoId
): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ nivel: number }>(
    `SELECT nivel FROM nivel_juego
      WHERE usuario_id = ? AND juego = ? AND intentos = 0;`,
    [usuarioId, juego]
  );
  return rows.map((r) => r.nivel);
}

export async function guardarNivel(
  usuarioId: number,
  juego: JuegoId,
  nivel: number,
  estrellas: number,
  puntaje: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO nivel_juego
       (usuario_id, juego, nivel, estrellas, mejor, intentos, jugado_en)
     VALUES (?,?,?,?,?,1,?)
     ON CONFLICT(usuario_id, juego, nivel) DO UPDATE SET
       estrellas = MAX(estrellas, excluded.estrellas),
       mejor     = MAX(mejor, excluded.mejor),
       intentos  = intentos + 1,
       jugado_en = excluded.jugado_en;`,
    [usuarioId, juego, nivel, estrellas, puntaje, Date.now()]
  );
}

/**
 * El nivel más alto desbloqueado.
 *
 * Basta con haber TERMINADO el anterior, sin importar cuántas estrellas
 * se sacaron. Antes pedía una estrella y eso dejaba gente atorada
 * repitiendo el mismo nivel: las estrellas son para motivar a volver,
 * no un peaje para avanzar.
 *
 * Los niveles abiertos con anuncio también cuentan, porque también
 * dejan fila en la tabla.
 */
export async function nivelDesbloqueado(
  usuarioId: number,
  juego: JuegoId
): Promise<number> {
  const db = await getDb();
  // `intentos > 0` es la clave. Antes contaba cualquier fila, y como
  // abrir con anuncio también deja fila, un solo video regalaba DOS
  // niveles: el pagado y el siguiente de la cadena. Ahora la cadena solo
  // avanza con niveles jugados de verdad, y el de anuncio se abre
  // aparte, por su cuenta.
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(MAX(nivel), 0) AS n FROM nivel_juego
      WHERE usuario_id = ? AND juego = ? AND intentos > 0;`,
    [usuarioId, juego]
  );
  return (row?.n ?? 0) + 1;
}

/**
 * Abre un nivel adelantado a cambio de ver un anuncio.
 *
 * Deja la fila con cero estrellas y cero intentos: el nivel queda
 * accesible pero sigue marcado como no jugado, así que el usuario ve
 * que le falta y puede volver por sus estrellas. Saltarse un nivel no
 * debe verse como haberlo hecho.
 */
export async function abrirConAnuncio(
  usuarioId: number,
  juego: JuegoId,
  nivel: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO nivel_juego
       (usuario_id, juego, nivel, estrellas, mejor, intentos, jugado_en)
     VALUES (?,?,?,0,0,0,?);`,
    [usuarioId, juego, nivel, Date.now()]
  );
}

/**
 * El resumen de los cuatro juegos en UNA consulta.
 *
 * Antes el arcade llamaba a `resumenJuego` por juego, y cada llamada
 * hacía dos consultas: ocho viajes a SQLite solo para pintar cuatro
 * renglones, más los otros cinco de la pantalla. Eso es lo que se
 * sentía al entrar.
 */
export async function resumenTodos(
  usuarioId: number
): Promise<Record<string, { jugados: number; estrellas: number; siguiente: number }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    juego: string;
    jugados: number;
    estrellas: number;
    ultimo: number;
  }>(
    `SELECT juego,
            SUM(CASE WHEN intentos > 0 THEN 1 ELSE 0 END) AS jugados,
            COALESCE(SUM(estrellas), 0) AS estrellas,
            COALESCE(MAX(CASE WHEN intentos > 0 THEN nivel END), 0) AS ultimo
       FROM nivel_juego
      WHERE usuario_id = ?
      GROUP BY juego;`,
    [usuarioId]
  );

  const out: Record<string, { jugados: number; estrellas: number; siguiente: number }> = {};
  for (const r of rows) {
    out[r.juego] = {
      jugados: r.jugados,
      estrellas: r.estrellas,
      siguiente: r.ultimo + 1,
    };
  }
  return out;
}

export async function resumenJuego(
  usuarioId: number,
  juego: JuegoId
): Promise<{ jugados: number; estrellas: number; siguiente: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ jugados: number; estrellas: number }>(
    `SELECT COUNT(*) AS jugados, COALESCE(SUM(estrellas), 0) AS estrellas
       FROM nivel_juego WHERE usuario_id = ? AND juego = ?;`,
    [usuarioId, juego]
  );
  const siguiente = await nivelDesbloqueado(usuarioId, juego);
  return {
    jugados: row?.jugados ?? 0,
    estrellas: row?.estrellas ?? 0,
    siguiente,
  };
}

/**
 * Cuántas estrellas dio este resultado.
 *
 * Los umbrales vienen del nivel. Cero estrellas significa que no se
 * terminó, y eso no abre el siguiente: es el único candado del sistema y
 * se quita con la mitad del nivel.
 */
export function estrellasPara(
  puntaje: number,
  umbrales: readonly [number, number, number]
): number {
  if (puntaje >= umbrales[2]) return 3;
  if (puntaje >= umbrales[1]) return 2;
  if (puntaje >= umbrales[0]) return 1;
  return 0;
}
