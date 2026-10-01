/**
 * El momento de la partida de Pares, con nombre. En Pares tres cosas pueden correr a la vez tras un
 * acierto (el cable que une el par, la voz de las dos frases y la tarjeta que vuela a su segmento), cada
 * una con su propio tope; la fase dice cuál manda y, sobre todo, cuándo el tablero acepta toques
 * (`jugando`). Con cada una con su tope, ningún camino deja el tablero bloqueado.
 */
export type FasePares =
  | 'armando'
  | 'repartiendo'
  | 'jugando'
  | 'fallando'
  | 'uniendo'
  | 'pausa'
  | 'aterrizando'
  | 'cerrando';

export interface EstadoPares {
  cargando: boolean;
  /** Ya cayó la última ficha del reparto. */
  repartido: boolean;
  /** Las dos fichas de un fallo que parpadean. */
  fallando: number;
  /** El cable está uniendo un par. */
  uniendo: boolean;
  /** Suenan las dos frases del par. */
  enPausa: boolean;
  /** La tarjeta del par vuela a su segmento. */
  enVuelo: boolean;
  /** Todos los pares resueltos y nada en curso: se cierra el tablero. */
  completo: boolean;
}

export function fasePares(e: EstadoPares): FasePares {
  if (e.cargando) return 'armando';
  if (e.completo) return 'cerrando';
  if (!e.repartido) return 'repartiendo';
  if (e.enPausa) return 'pausa';
  if (e.uniendo) return 'uniendo';
  if (e.enVuelo) return 'aterrizando';
  if (e.fallando > 0) return 'fallando';
  return 'jugando';
}
