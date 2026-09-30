/* ---------- niveles.json ---------- */

/** Un tramo del catálogo del que salen las entradas de varios niveles. */
export interface BandaNivel {
  id: string;
  nombre: string;
  desde: number;
  hasta: number;
  ids: number[];
}

/** Lo común a todos los juegos. Cada uno agrega sus propios campos. */
export interface NivelBase {
  n: number;
  banda: string;
  /** Umbrales de una, dos y tres estrellas. */
  estrellas: [number, number, number];
}

export interface NivelColmena extends NivelBase {
  rondas: number;
  senuelos: number;
  pistasGratis: number;
  /** Segundos por ronda. Nunca baja de 12. */
  segundosRonda: number;
}

export interface NivelPares extends NivelBase {
  pares: number;
  jugadas: number;
  /** Segundos para el tablero completo, no por pareja. */
  segundosTablero: number;
}

export interface NivelCaida extends NivelBase {
  rondas: number;
  caidaInicialMs: number;
  caidaMinimaMs: number;
  aceleraMs: number;
}

export interface NivelDulces extends NivelBase {
  cols: number;
  rows: number;
  colores: number;
  frases: number;
  jugadas: number;
  metaPorFrase: number;
}

export type NivelJuego =
  | NivelColmena
  | NivelPares
  | NivelCaida
  | NivelDulces;

export interface JuegoNiveles {
  nombre: string;
  total: number;
  bandas: BandaNivel[];
  niveles: NivelJuego[];
}

export interface NivelesFile {
  version: number;
  nivelesPorJuego: number;
  nota: string;
  juegos: Record<string, JuegoNiveles>;
}
