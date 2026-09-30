/**
 * Cada ronda de Colmena como máquina de estados:
 *
 *   jugando ──resolver──▶ resuelta ──salir──▶ saliendo
 *   (cualquiera) ──nuevaRonda──▶ jugando
 *
 * `resolver` lleva cómo se resolvió: armada por quien juega (`ayudaDesde: null`), completada con «No me
 * sale» o porque se acabó el tiempo (`seAcabo`). Mientras el panal sale se sigue viendo la ronda resuelta.
 * Un evento que no toca en el estado actual lo deja igual: la ronda no se puede resolver dos veces.
 */
export type EstadoRonda =
  | { fase: 'jugando' }
  | { fase: 'resuelta' | 'saliendo'; ayudaDesde: number | null; seAcabo: boolean };

export type EventoRonda =
  | { tipo: 'resolver'; ayudaDesde: number | null; seAcabo: boolean }
  | { tipo: 'salir' }
  | { tipo: 'nuevaRonda' };

export const RONDA_INICIAL: EstadoRonda = { fase: 'jugando' };

export function rondaColmena(estado: EstadoRonda, evento: EventoRonda): EstadoRonda {
  switch (evento.tipo) {
    case 'resolver':
      return estado.fase === 'jugando'
        ? { fase: 'resuelta', ayudaDesde: evento.ayudaDesde, seAcabo: evento.seAcabo }
        : estado;
    case 'salir':
      return estado.fase === 'resuelta' ? { ...estado, fase: 'saliendo' } : estado;
    case 'nuevaRonda':
      return estado.fase === 'jugando' ? estado : RONDA_INICIAL;
  }
}

/** Las fases con nombre de la partida, incluida la carga y el fin (sin ronda que mostrar). */
export type FaseColmena = 'armando' | EstadoRonda['fase'] | 'fin';

export function faseColmena(estado: EstadoRonda, cargando: boolean, hayRonda: boolean): FaseColmena {
  if (cargando) return 'armando';
  if (!hayRonda) return 'fin';
  return estado.fase;
}
