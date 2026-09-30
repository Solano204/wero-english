import { shuffle } from '@/domain/arreglos';
import { blankOut } from '@/domain/texto';
import type {
  AnswerMode,
  CardState,
  Entry,
  ExerciseKind,
  StudyCard,
} from '@/types';

/**
 * Elige el ejercicio según cuánto sabe el usuario la entrada.
 *
 * La progresión importa: si la primera vez que ves una frase te piden
 * escribirla, te rindes. Y si a la décima te siguen dando cuatro
 * opciones, no aprendes a producirla.
 *
 * La v3 mete dos peldaños entre tocar y escribir, que es justo donde la
 * gente abandona:
 *
 *   0     reconocer   cuatro significados
 *   1-2   escuchar    solo audio
 *   3     construir   fichas de palabras, con señuelos
 *   4     completar   un hueco en la frase
 *   5     dictado     audio a dos velocidades, se escribe
 *   6+    escribir    del español al inglés, en frío
 *
 * Cada peldaño tiene condiciones de datos. Si no se cumplen se baja al
 * anterior en vez de saltar al siguiente: subir de golpe es lo que
 * rompe la sesión.
 */

/** Mínimo de palabras para que armar la frase sea un ejercicio real. */
export const CONSTRUIR_MIN_PALABRAS = 3;

export function pickKind(
  entry: Entry,
  state: CardState,
  hasAudio: boolean
): ExerciseKind {
  const reps = state.repeticiones;

  if (reps === 0) return 'reconocer';

  // Se atora: se baja la exigencia en vez de insistir con lo difícil.
  if (state.fallos >= 3 && state.aciertos < state.fallos) return 'reconocer';

  const puedeEscuchar = hasAudio;
  const puedeConstruir = entry.word_count >= CONSTRUIR_MIN_PALABRAS;
  const puedeCompletar =
    entry.completar_palabra !== null &&
    entry.completar_distractores.length === 3;
  const puedeDictado = hasAudio;

  if (reps <= 2) return puedeEscuchar ? 'escuchar' : 'reconocer';

  if (reps === 3) {
    if (puedeConstruir) return 'construir';
    return puedeCompletar ? 'completar' : 'reconocer';
  }

  if (reps === 4) {
    if (puedeCompletar) return 'completar';
    return puedeConstruir ? 'construir' : 'escribir';
  }

  if (reps === 5) {
    if (puedeDictado) return 'dictado';
    return 'escribir';
  }

  // De la sexta en adelante se alterna, con más peso a producir.
  const pool: ExerciseKind[] = ['escribir', 'escribir'];
  if (puedeDictado) pool.push('dictado');
  if (puedeConstruir) pool.push('construir');
  if (puedeCompletar) pool.push('completar');
  if (puedeEscuchar) pool.push('escuchar');
  pool.push('reconocer');

  const idx = (reps + state.aciertos) % pool.length;
  return pool[idx] ?? 'reconocer';
}

/**
 * Arma la tarjeta lista para pintarse.
 *
 * `wordDecoys` son palabras sueltas en inglés del mismo pack y solo las
 * usa Construir. Se pasan por parámetro en vez de consultarlas aquí
 * para que esta función siga siendo pura y comprobable sin base.
 */
export function buildCard(
  entry: Entry,
  state: CardState,
  distractors: string[],
  isRelearn = false,
  wordDecoys: string[] = []
): StudyCard {
  const hasAudio = Boolean(entry.audio_en);
  const kind = pickKind(entry, state, hasAudio);

  switch (kind) {
    case 'reconocer':
    case 'escuchar': {
      const answer = entry.spanish_main;
      const wrong = distractors.filter((d) => d !== answer).slice(0, 3);
      return {
        entry,
        state,
        kind,
        answer,
        options: shuffle([answer, ...wrong]),
        isRelearn,
      };
    }
    case 'construir': {
      const palabras = splitPhrase(entry.phrase_tts);
      const propias = new Set(palabras.map((w) => w.toLowerCase()));
      const senuelos = wordDecoys
        .filter((w) => !propias.has(w.toLowerCase()))
        .slice(0, 3);
      return {
        entry,
        state,
        kind,
        // La respuesta es la frase tal cual: la comparación se hace
        // palabra por palabra en la vista, no con el texto crudo.
        answer: palabras.join(' '),
        options: shuffle([...palabras, ...senuelos]),
        isRelearn,
      };
    }
    case 'completar': {
      const answer = entry.completar_palabra ?? '';
      return {
        entry,
        state,
        kind,
        answer,
        options: shuffle([answer, ...entry.completar_distractores]),
        isRelearn,
      };
    }
    case 'dictado':
    case 'escribir':
      return {
        entry,
        state,
        kind,
        answer: entry.phrase_tts,
        options: [],
        isRelearn,
      };
  }
}

/**
 * Parte la frase en fichas.
 *
 * Se conserva la puntuación pegada a la palabra ("bro," queda junto)
 * porque separarla obligaría al usuario a acomodar una coma suelta, que
 * no enseña nada de inglés y sí frustra.
 */
export function splitPhrase(phrase: string): string[] {
  return phrase
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/** El texto que se muestra arriba de la tarjeta según el ejercicio. */
export function promptFor(card: StudyCard): string {
  switch (card.kind) {
    case 'reconocer':
      return card.entry.phrase;
    case 'escuchar':
    case 'dictado':
      return '';
    case 'construir':
      return card.entry.spanish_main;
    case 'completar':
      return blankOut(card.entry.phrase_tts, card.answer);
    case 'escribir':
      return card.entry.spanish_main;
  }
}

export function instructionFor(kind: ExerciseKind): string {
  switch (kind) {
    case 'reconocer':
      return '¿Qué significa?';
    case 'escuchar':
      return 'Escucha y elige';
    case 'construir':
      return 'Arma la frase';
    case 'completar':
      return 'Completa la frase';
    case 'dictado':
      return 'Escucha y escribe';
    case 'escribir':
      return 'Escríbelo en inglés';
  }
}

/** Cómo se responde: tocando opciones, acomodando fichas o escribiendo. */
export function answerMode(kind: ExerciseKind): AnswerMode {
  if (kind === 'construir') return 'tiles';
  if (kind === 'dictado' || kind === 'escribir') return 'type';
  return 'choice';
}

/** ¿Este ejercicio se responde tocando una de cuatro opciones? */
export function isChoice(kind: ExerciseKind): boolean {
  return answerMode(kind) === 'choice';
}

/**
 * ¿La imagen de la frase regala la respuesta si se ve completa antes de responder?
 *
 * Reconocer y Escuchar preguntan "¿qué significa?" entre cuatro traducciones: la imagen
 * de la escena adelanta el significado. En Construir y Escribir el significado YA es el
 * prompt visible (`promptFor` da `spanish_main`); en Completar y Dictado la incógnita es
 * una palabra o una transcripción exacta, no el significado. En esos cuatro la imagen no
 * adelanta nada, así que se ve normal desde el inicio.
 */
export function imagenRevelaSignificado(kind: ExerciseKind): boolean {
  return kind === 'reconocer' || kind === 'escuchar';
}
