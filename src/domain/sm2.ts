import { addDays, startOfDay } from '@/domain/fechas';
import { conteo } from '@/domain/texto';
import type { CardState, Grade } from '@/types';

/**
 * SM-2 con dos ajustes respecto al algoritmo original:
 *
 * 1. Pasos de aprendizaje. Una tarjeta nueva o fallada no se va a días:
 *    vuelve en la misma sesión. Anki hace esto y es la diferencia entre
 *    aprender algo hoy y volver a fallarlo mañana desde cero.
 *
 * 2. Piso de facilidad en 1.3. Sin ese piso, una tarjeta que se falla
 *    cinco veces baja tanto la facilidad que reaparece cada día para
 *    siempre y envenena la cola.
 */

export const EASE_MIN = 1.3;
export const EASE_MAX = 2.8;
export const EASE_START = 2.5;

/** Minutos de los pasos de aprendizaje, dentro de la misma sesión. */
export const LEARN_STEPS_MIN = [1, 10] as const;

/** Con cuántas repeticiones y qué intervalo se considera dominada. */
export const MASTERED_REPS = 4;
export const MASTERED_INTERVAL = 21;

export interface Sm2Result {
  state: CardState;
  /** true si la tarjeta debe volver en esta misma sesión. */
  requeue: boolean;
  /** Minutos hasta que vuelva, solo si requeue. */
  requeueInMin: number;
}

export function newCardState(entryId: number): CardState {
  return {
    entry_id: entryId,
    repeticiones: 0,
    intervalo: 0,
    facilidad: EASE_START,
    vence_en: 0,
    ultimo_repaso: null,
    fallos: 0,
    aciertos: 0,
    dominada: 0,
    favorito: 0,
  };
}

/**
 * Aplica una calificación y devuelve el estado nuevo.
 *
 * Grado 1 = falló · 2 = costó · 3 = bien · 4 = fácil
 */
export function review(
  prev: CardState,
  grade: Grade,
  now: number = Date.now()
): Sm2Result {
  const s: CardState = { ...prev };
  s.ultimo_repaso = now;

  if (grade === 1) {
    s.fallos = prev.fallos + 1;
    s.repeticiones = 0;
    s.intervalo = 0;
    s.dominada = 0;
    s.facilidad = clampEase(prev.facilidad - 0.2);
    // Vuelve en un minuto: el usuario acaba de ver la respuesta y
    // reforzarla de inmediato es lo que la fija.
    s.vence_en = now + LEARN_STEPS_MIN[0] * 60_000;
    return { state: s, requeue: true, requeueInMin: LEARN_STEPS_MIN[0] };
  }

  s.aciertos = prev.aciertos + 1;
  s.repeticiones = prev.repeticiones + 1;
  s.facilidad = clampEase(prev.facilidad + easeDelta(grade));

  // Pasos de aprendizaje: las dos primeras veces se queda en la sesión.
  if (s.repeticiones <= LEARN_STEPS_MIN.length) {
    const idx = s.repeticiones - 1;
    const min = LEARN_STEPS_MIN[idx] ?? 10;
    s.intervalo = 0;
    s.vence_en = now + min * 60_000;
    return { state: s, requeue: true, requeueInMin: min };
  }

  // Ya graduó: el intervalo pasa a días.
  if (s.repeticiones === LEARN_STEPS_MIN.length + 1) {
    s.intervalo = grade === 4 ? 3 : 1;
  } else {
    const factor = grade === 2 ? 1.2 : s.facilidad;
    s.intervalo = Math.max(1, Math.round(prev.intervalo * factor));
  }

  // Un tope de seis meses: más allá, el usuario ya no la recuerda por
  // la app sino porque la usa, y no vale la pena guardarle turno.
  s.intervalo = Math.min(s.intervalo, 180);

  // Se vence al inicio del día objetivo, no a la hora exacta, para que
  // "las de hoy" signifique lo mismo a las 7 am y a las 11 pm.
  s.vence_en = startOfDay(addDays(now, s.intervalo));

  s.dominada =
    s.repeticiones >= MASTERED_REPS && s.intervalo >= MASTERED_INTERVAL
      ? 1
      : 0;

  return { state: s, requeue: false, requeueInMin: 0 };
}

function easeDelta(grade: Grade): number {
  switch (grade) {
    case 2:
      return -0.15;
    case 3:
      return 0;
    case 4:
      return 0.1;
    default:
      return 0;
  }
}

function clampEase(v: number): number {
  return Math.min(EASE_MAX, Math.max(EASE_MIN, Number(v.toFixed(3))));
}

/**
 * Deriva la calificación de lo que hizo el usuario.
 *
 * El umbral de 4 segundos no es arbitrario: por debajo de eso el usuario
 * reconoció la frase sin razonarla, que es justo lo que queremos premiar
 * con un intervalo más largo.
 */
export function gradeFrom(
  correct: boolean,
  elapsedMs: number,
  usedHint: boolean
): Grade {
  if (!correct) return 1;
  if (usedHint) return 2;
  if (elapsedMs < 4_000) return 4;
  if (elapsedMs < 12_000) return 3;
  return 2;
}

/** Cuándo vuelve a verse, en texto, para la tarjeta de resultado. */
export function nextReviewLabel(s: CardState): string {
  if (s.intervalo === 0) return 'en esta sesión';
  if (s.intervalo === 1) return 'mañana';
  if (s.intervalo < 7) return `en ${conteo(s.intervalo, 'día')}`;
  if (s.intervalo < 30) return `en ${conteo(Math.round(s.intervalo / 7), 'semana')}`;
  return `en ${conteo(Math.round(s.intervalo / 30), 'mes', 'meses')}`;
}
