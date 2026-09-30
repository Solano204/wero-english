import { shuffle } from '@/domain/arreglos';
import type { DulceObjetivo, Entry } from '@/types';
import type { PreguntaDulces } from '../components/HojaPregunta';

/**
 * La partida de Dulces como máquina de estados. Solo hay cuatro momentos y nunca se enciman:
 *
 *   jugando ──animar──▶ animando ──finAnimacion──▶ jugando
 *   jugando|animando ──abrirPregunta──▶ pregunta ──responder──▶ respondiendo
 *   pregunta|respondiendo ──cerrarPregunta──▶ jugando
 *
 * Un evento que no toca en el estado actual lo deja igual: ningún toque a destiempo puede dejar la partida
 * en un estado imposible (una pregunta abierta con el tablero animando, una respuesta sin pregunta…).
 * «Armando» (cargando) y «fin» (sin jugadas) no viven aquí: salen de la carga y del contador (ver `fasePartida`).
 */
export type EstadoPartida =
  | { fase: 'jugando' }
  | { fase: 'animando' }
  | { fase: 'pregunta'; pregunta: PreguntaDulces }
  | { fase: 'respondiendo'; pregunta: PreguntaDulces; opcion: string };

export type EventoPartida =
  | { tipo: 'animar' }
  | { tipo: 'finAnimacion' }
  | { tipo: 'abrirPregunta'; pregunta: PreguntaDulces }
  | { tipo: 'responder'; opcion: string }
  | { tipo: 'cerrarPregunta' };

export const PARTIDA_INICIAL: EstadoPartida = { fase: 'jugando' };

export function partidaDulces(estado: EstadoPartida, evento: EventoPartida): EstadoPartida {
  switch (evento.tipo) {
    case 'animar':
      return estado.fase === 'jugando' ? { fase: 'animando' } : estado;
    case 'finAnimacion':
      return estado.fase === 'animando' ? { fase: 'jugando' } : estado;
    case 'abrirPregunta':
      return estado.fase === 'jugando' || estado.fase === 'animando'
        ? { fase: 'pregunta', pregunta: evento.pregunta }
        : estado;
    case 'responder':
      return estado.fase === 'pregunta'
        ? { fase: 'respondiendo', pregunta: estado.pregunta, opcion: evento.opcion }
        : estado;
    case 'cerrarPregunta':
      return estado.fase === 'pregunta' || estado.fase === 'respondiendo' ? { fase: 'jugando' } : estado;
  }
}

/** Las fases con nombre de toda la partida, incluidas las que no guarda la máquina. */
export type FaseDulces = 'armando' | EstadoPartida['fase'] | 'fin';

export function fasePartida(estado: EstadoPartida, cargando: boolean, jugadas: number): FaseDulces {
  if (cargando) return 'armando';
  if (estado.fase === 'jugando' && jugadas <= 0) return 'fin';
  return estado.fase;
}

/**
 * Tres opciones: la correcta y dos de otras frases del mismo montón.
 * Cuatro no caben junto al tablero sin hacer scroll, y hacer scroll en
 * medio de una pregunta rompe el ritmo del juego.
 */
export function opcionesPara(o: DulceObjetivo, pool: Entry[]): string[] {
  const correcta = o.entry.spanish_main;
  const otras = shuffle(
    pool
      .filter((e) => e.id !== o.entry.id && e.spanish_main !== correcta)
      .map((e) => e.spanish_main)
  ).slice(0, 2);
  return shuffle([correcta, ...otras]);
}

/**
 * De los colores quitados en la jugada, cuál se lleva la voz del
 * match: el de más piezas y, en empate, el más cerca de llenar su
 * barra (ya con lo de esta jugada sumado).
 */
export function mejorColor(
  porColor: Record<number, number>,
  objetivos: DulceObjetivo[]
): number | null {
  let mejor: number | null = null;
  let mejorPiezas = -1;
  let mejorCercania = -1;

  for (const [colStr, piezas] of Object.entries(porColor)) {
    const col = Number(colStr);
    const o = objetivos.find((x) => x.color === col);
    const cercania = o ? o.llevas / o.meta : 0;
    if (piezas > mejorPiezas || (piezas === mejorPiezas && cercania > mejorCercania)) {
      mejor = col;
      mejorPiezas = piezas;
      mejorCercania = cercania;
    }
  }
  return mejor;
}
