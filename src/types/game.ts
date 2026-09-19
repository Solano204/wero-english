import type { Entry } from './catalog';
import type { Arquetipo, Escenario, CazalaItem } from './content';

/** Una ronda de "¿Lo digo o no?". */
/** Una ronda de "Cázala". */
export interface CazalaRound {
  item: CazalaItem;
  /** Las seis opciones ya barajadas, con su etiqueta legible. */
  options: { id: number; label: string }[];
}

/* ============================================================
   Juegos nuevos de la v3
   ============================================================ */

/** Una ronda de Colmena: se arma la palabra inglesa letra por letra. */
export interface ColmenaRound {
  entry: Entry;
  /** La palabra objetivo, en minúsculas. Sale de completar_palabra. */
  objetivo: string;
  /** La pista en español que se muestra arriba. */
  pista: string;
  /** Las letras disponibles, ya barajadas, con señuelos incluidos. */
  letras: string[];
}

/** Una ficha del tablero de Pares. */
export interface ParFicha {
  id: string;
  entryId: number;
  texto: string;
  lado: 'en' | 'es';
}

/** Un tablero de Pares: fichas barajadas y presupuesto de jugadas. */
export interface ParesTablero {
  fichas: ParFicha[];
  totalPares: number;
  jugadas: number;
}

/** Una ronda del laboratorio de pares mínimos, con micrófono. */
export interface ParMinimoRound {
  /** Id compuesto fonema:indice, para el registro en habla_log. */
  id: string;
  objetivo: string;
  objetivoIpa: string;
  objetivoEs: string;
  /** La palabra con la que se confunde. Es el juez del ejercicio. */
  confusa: string;
  confusaEs: string;
  audioObjetivo: string;
  fonema: string;
  elErrorTipico: string;
}

/** Lo que devuelve el reconocedor después de un intento. */
export type HablaVeredicto =
  | { tipo: 'acierto'; oido: string }
  | { tipo: 'confusa'; oido: string }
  | { tipo: 'otra_cosa'; oido: string }
  | { tipo: 'silencio' }
  | { tipo: 'no_disponible'; razon: string };

/** Una ronda de Caída: dos tarjetas bajando y un reloj. */
export interface CaidaRound {
  entry: Entry;
  correcta: string;
  falsa: string;
  duracionMs: number;
  correctaIzquierda: boolean;
}

/** Una frase enganchada a un color del tablero de Dulces. */
export interface DulceObjetivo {
  entry: Entry;
  /** El color del tablero que le toca, 0 a 4. */
  color: number;
  /** Piezas de ese color quitadas hasta ahora. */
  llevas: number;
  /** Cuántas hacen falta para que salga la pregunta. */
  meta: number;
}
