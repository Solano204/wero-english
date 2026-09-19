import type { Entry } from './catalog';

/**
 * Los seis tipos de ejercicio, en orden de dificultad creciente.
 *
 * 'construir' y 'dictado' se agregaron en la v3 para tapar el salto que
 * había entre tocar una opción y escribir la frase completa. Ese salto
 * es donde el usuario abandona.
 */
export type ExerciseKind =
  | 'reconocer'
  | 'escuchar'
  | 'construir'
  | 'completar'
  | 'dictado'
  | 'escribir';

/** Cómo se responde cada ejercicio. Lo consume StudyCardView. */
export type AnswerMode = 'choice' | 'tiles' | 'type';

/** Calificación SM-2. Coincide con el mockup: 1 fallo, 4 acierto rápido. */
export type Grade = 1 | 2 | 3 | 4;

/** Fila de la tabla tarjeta: el estado SM-2 de una entrada. */
export interface CardState {
  entry_id: number;
  repeticiones: number;
  intervalo: number;
  facilidad: number;
  vence_en: number;
  ultimo_repaso: number | null;
  fallos: number;
  aciertos: number;
  dominada: 0 | 1;
  favorito: 0 | 1;
}

/** Una tarjeta lista para mostrarse: entrada + estado + ejercicio elegido. */
export interface StudyCard {
  entry: Entry;
  state: CardState;
  kind: ExerciseKind;
  /**
   * En 'reconocer' y 'escuchar' son significados; en 'completar' son
   * palabras; en 'construir' son las fichas de la frase más los señuelos.
   * En 'dictado' y 'escribir' va vacío.
   */
  options: string[];
  answer: string;
  /** true si es un paso de aprendizaje reinsertado en la misma sesión. */
  isRelearn: boolean;
}

export interface AnswerResult {
  grade: Grade;
  correct: boolean;
  elapsedMs: number;
  usedHint: boolean;
}

export interface SessionSummary {
  correct: number;
  total: number;
  newCards: number;
  streak: number;
  missed: Entry[];
  durationMs: number;
  /** La racha de aciertos seguidos más larga de esta sesión. */
  mejorRacha: number;
}
