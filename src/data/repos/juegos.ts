import { getCardState, upsertCardState } from './tarjetas';
import { gradeFrom, newCardState, review } from '@/domain/sm2';
import type { Grade } from '@/types';

/**
 * Puente entre los juegos y SM-2.
 *
 * Esta función es la razón por la que el arcade no compite con la
 * sesión: cada ronda acertada mueve la tarjeta en la cola igual que si
 * se hubiera respondido en P-05. Un usuario que solo juega, avanza.
 *
 * La calificación se topa según el juego. Colmena pide producir la
 * palabra, así que vale como un Completar. Pares es reconocimiento, así
 * que nunca da grado 4: acertar un tablero de ocho fichas por
 * eliminación no es lo mismo que recordar la frase en frío.
 */

export type FuerzaJuego = 'reconocer' | 'producir';

export async function applyGameGrade(
  usuarioId: number,
  entryId: number,
  correct: boolean,
  elapsedMs: number,
  fuerza: FuerzaJuego = 'reconocer'
): Promise<void> {
  const previo = (await getCardState(usuarioId, entryId)) ?? newCardState(entryId);

  let grade: Grade = gradeFrom(correct, elapsedMs, false);
  if (fuerza === 'reconocer' && grade === 4) grade = 3;

  const { state } = review(previo, grade);
  await upsertCardState(usuarioId, state);
}
