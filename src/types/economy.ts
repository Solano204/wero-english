/**
 * Tipos de los juegos y del reto semanal.
 *
 * La economía de monedas se eliminó, así que Wallet, Premio y Cosmetico
 * ya no existen. Si algún día vuelve, vuelve aquí.
 */

/** Qué juegos existen. La clave se guarda en juego_log.juego. */
export type JuegoId =
  | 'colmena'
  | 'pares'
  | 'caida'
  | 'dulces'
  | 'cazala'
  | 'pares_minimos';

export interface JuegoRecord {
  juego: JuegoId;
  partidas: number;
  mejor: number;
  ultimaFecha: string | null;
}

export interface RetoSemanal {
  /** Aciertos acumulados de lunes a hoy. */
  llevas: number;
  meta: number;
  /** Lunes de la semana en curso, YYYY-MM-DD. */
  desde: string;
  cumplido: boolean;
}
