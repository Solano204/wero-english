/**
 * Una ronda de Cázala como máquina de estados:
 *
 *   marcando ──marcar──▶ marcando        (hasta `MARCAS` reducciones)
 *   marcando ──revisar──▶ revisada       (solo con las marcas completas)
 *   (cualquiera) ──nuevaRonda──▶ marcando, sin marcas
 *
 * Revisada ya no acepta marcas: un toque tarde no cambia lo que se calificó.
 */
export type EstadoRonda = { fase: 'marcando' | 'revisada'; marcadas: number[] };

export type EventoRonda =
  | { tipo: 'marcar'; marcadas: number[] }
  | { tipo: 'revisar'; marcas: number }
  | { tipo: 'nuevaRonda' };

export const RONDA_INICIAL: EstadoRonda = { fase: 'marcando', marcadas: [] };

export function rondaCazala(estado: EstadoRonda, evento: EventoRonda): EstadoRonda {
  switch (evento.tipo) {
    case 'marcar':
      return estado.fase === 'marcando' ? { fase: 'marcando', marcadas: evento.marcadas } : estado;
    case 'revisar':
      return estado.fase === 'marcando' && estado.marcadas.length === evento.marcas ? { ...estado, fase: 'revisada' } : estado;
    case 'nuevaRonda':
      return RONDA_INICIAL;
  }
}

/**
 * Marca o desmarca una reducción. Devuelve la MISMA lista si no cambia nada (ya hay `max` marcadas y esta
 * no era una de ellas): así quien llama sabe que no hubo cambio y no vibra ni anuncia.
 */
export function alternarMarca(marcadas: number[], id: number, max: number): number[] {
  if (marcadas.includes(id)) return marcadas.filter((x) => x !== id);
  return marcadas.length < max ? [...marcadas, id] : marcadas;
}
