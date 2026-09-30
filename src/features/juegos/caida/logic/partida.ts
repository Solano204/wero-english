import type { EstadoFicha } from '@/features/juegos/caida/components/FichaCaida';
import type { Entry } from '@/types';

/**
 * La partida de Caída como máquina de estados:
 *
 *   cayendo ──pausar──▶ pausa ──soltarPausa──▶ cayendo
 *   cayendo ──perder──▶ perdida ──otraVez──▶ cayendo
 *
 * La pausa es el fin de cada ronda (acierto o fallo): congela la caída y dice la frase. Una ronda perdida
 * pasa por la pausa y, al soltarla, a `perdida` (la pantalla final con «Otra vez»). Un evento que no toca en
 * el estado actual lo deja igual, así que un toque o un aviso a destiempo no pueden dejar la partida colgada.
 */
export type EstadoPartida =
  | { fase: 'cayendo' }
  | { fase: 'pausa'; entry: Entry; correct: boolean }
  | { fase: 'perdida' };

export type EventoPartida =
  | { tipo: 'pausar'; entry: Entry; correct: boolean }
  | { tipo: 'soltarPausa' }
  | { tipo: 'perder' }
  | { tipo: 'otraVez' };

export const PARTIDA_INICIAL: EstadoPartida = { fase: 'cayendo' };

export function partidaCaida(estado: EstadoPartida, evento: EventoPartida): EstadoPartida {
  switch (evento.tipo) {
    case 'pausar':
      return estado.fase === 'cayendo' ? { fase: 'pausa', entry: evento.entry, correct: evento.correct } : estado;
    case 'soltarPausa':
      return estado.fase === 'pausa' ? { fase: 'cayendo' } : estado;
    case 'perder':
      return estado.fase === 'cayendo' ? { fase: 'perdida' } : estado;
    case 'otraVez':
      return estado.fase === 'perdida' ? { fase: 'cayendo' } : estado;
  }
}

/** Las fases con nombre de toda la partida, incluida la carga. */
export type FaseCaida = 'armando' | EstadoPartida['fase'];

export function fasePartida(estado: EstadoPartida, cargando: boolean): FaseCaida {
  return cargando ? 'armando' : estado.fase;
}

/**
 * Qué le pasó a una ficha esta ronda: la acertada, la equivocada (`fallada`), la que era tras un fallo
 * (`correcta`) o la que sobra tras un acierto.
 */
export function estadoFicha(
  texto: string,
  correcta: string,
  fallada: string | null,
  acertada: string | null,
  ronda: number
): EstadoFicha {
  if (fallada === texto) return 'fallo';
  if (fallada !== null && texto === correcta) return 'correcta';
  if (acertada === `${ronda}|${texto}`) return 'acierto';
  return acertada?.startsWith(`${ronda}|`) ? 'descartada' : 'normal';
}
