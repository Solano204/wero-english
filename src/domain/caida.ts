import { pickRandom, shuffle } from '@/utils/array';
import type { CaidaRound, Entry } from '@/types';

/**
 * Caída: la frase aparece arriba y dos tarjetas bajan por la pantalla.
 * Hay que tocar la correcta antes de que lleguen abajo. Si se toca la
 * equivocada, o si llegan al piso, se acabó.
 *
 * Este es el único modo de toda la app donde se puede perder, y es a
 * pedido expreso. Para que no contradiga la regla de "nada se castiga",
 * perder aquí no toca nada de afuera: no rompe la racha ni marca la
 * tarjeta como fallada más de lo que ya la marcaría una respuesta
 * equivocada en una sesión normal. Se pierde la partida, no el progreso.
 */

/** Cuánto tarda en caer la primera tarjeta. */
export const CAIDA_INICIAL_MS = 5000;

/** El piso: por rápido que se ponga, nunca baja de aquí. */
export const CAIDA_MINIMA_MS = 2400;

/** Cuánto se acorta cada ronda. */
const ACELERA_MS = 140;

/** Cada cuántas rondas se acelera. Todas sería injugable a la décima. */
const CADA = 1;

export interface RitmoCaida {
  inicialMs: number;
  minimaMs: number;
  aceleraMs: number;
}

export const RITMO_DEFECTO: RitmoCaida = {
  inicialMs: CAIDA_INICIAL_MS,
  minimaMs: CAIDA_MINIMA_MS,
  aceleraMs: ACELERA_MS,
};

export function duracionPara(
  ronda: number,
  ritmo: RitmoCaida = RITMO_DEFECTO
): number {
  const bajada = Math.floor(ronda / CADA) * ritmo.aceleraMs;
  return Math.max(ritmo.minimaMs, ritmo.inicialMs - bajada);
}

/**
 * Arma las rondas. Se generan muchas de golpe porque la partida no
 * tiene final fijo: dura lo que el usuario aguante.
 */
export function buildRounds(
  pool: Entry[],
  total = 40,
  ritmo: RitmoCaida = RITMO_DEFECTO
): CaidaRound[] {
  const usables = pool.filter(esUsable);
  if (usables.length < 4) return [];

  const orden = shuffle(usables);
  const out: CaidaRound[] = [];

  // Sin módulo. Con `i % orden.length` la partida daba la vuelta y
  // repetía frases cuando el nivel pedía más rondas de las que había en
  // la bolsa: el usuario veía la misma dos veces y parecía que el juego
  // se había quedado sin contenido. Es mejor una partida más corta.
  const cuantas = Math.min(total, orden.length);

  for (let i = 0; i < cuantas; i++) {
    const entry = orden[i];
    if (!entry) break;

    const falsa = distractorPara(entry, usables);
    if (!falsa) continue;

    out.push({
      entry,
      correcta: entry.spanish_main,
      falsa,
      duracionMs: duracionPara(out.length, ritmo),
      // Que la correcta caiga siempre del mismo lado se aprende en tres
      // rondas y a partir de ahí el juego se responde sin leer.
      correctaIzquierda: Math.random() < 0.5,
    });
  }

  return out;
}

function esUsable(e: Entry): boolean {
  // Un significado largo no se alcanza a leer mientras cae.
  if (e.spanish_main.length > 32) return false;
  return e.spanish_main.trim().length > 0;
}

/**
 * El señuelo sale del mismo mundo y con largo parecido. Si uno es de
 * dos palabras y el otro de siete, se contesta por forma y no por
 * significado, que es exactamente lo que no se quiere entrenar.
 */
function distractorPara(entry: Entry, pool: Entry[]): string | null {
  const largo = entry.spanish_main.length;

  const mismoMundo = pool.filter(
    (e) =>
      e.id !== entry.id &&
      e.mundo === entry.mundo &&
      e.spanish_main !== entry.spanish_main &&
      Math.abs(e.spanish_main.length - largo) <= 12
  );

  const elegido =
    pickRandom(mismoMundo) ??
    pickRandom(
      pool.filter(
        (e) => e.id !== entry.id && e.spanish_main !== entry.spanish_main
      )
    );

  return elegido?.spanish_main ?? null;
}
