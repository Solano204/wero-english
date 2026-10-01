import * as media from './media';
import { marcar, soltar } from '@/services/audio/estadoReproductor';
import type { SfxKey } from '@/services/audio/paquetesSfx';
import {
  efectoPermitido,
  esperarSfx,
  liberarEfectos,
  marcarEfectoTocado,
  pausarEfectosVivos,
  prepararEfecto,
  reiniciaRacha,
  tasaDetune,
} from '@/services/audio/efectos';
import { TOPE_NATIVO_MS, conTope, frase, initAudio } from '@/services/audio/estado';
import { play, playAndWait } from '@/services/audio/reproductor';

/**
 * Reproductor de audio.
 *
 * Un solo player reutilizado en vez de uno por sonido. Crear un player
 * por reproducción filtra memoria nativa y en una sesión de 60 tarjetas
 * con dos toques cada una la app se pone a tirones.
 */

async function playSfx(key: SfxKey): Promise<void> {
  if (!efectoPermitido(key)) return;

  try {
    await conTope(initAudio(), TOPE_NATIVO_MS, undefined);

    // Nunca encimado con la frase: el efecto la corta, no suena junto a ella.
    stop();

    const p = prepararEfecto(key);
    try {
      await conTope(p.seekTo(0), TOPE_NATIVO_MS, undefined);
    } catch {
      // Si no puede rebobinar, suena desde donde iba.
    }
    marcar(p, { playing: false, currentTime: 0, arrancando: false });
    try {
      // Sin 'high': a diferencia de la voz, aquí SÍ se quiere que el tono
      // se mueva un poco con la velocidad (es el detune de ±2 %).
      p.setPlaybackRate(tasaDetune());
    } catch {
      // Si el dispositivo no lo permite, suena a tono fijo: solo varían timbre/nota.
    }
    p.play();
    marcar(p, { arrancando: true });
    marcarEfectoTocado(p);
  } catch (err) {
    if (__DEV__) console.warn('[audio] no se pudo reproducir el efecto', key, err);
  }
}

/** Efecto corto al acertar. */
export function playSuccess(): Promise<void> {
  return playSfx('success');
}

/** Efecto corto y suave al fallar. Nunca debe sonar a regaño. */
export function playFail(): Promise<void> {
  return playSfx('fail');
}

/** Toque muy corto y discreto: fichas, letras, cartas. */
export function playTap(): Promise<void> {
  return playSfx('tap');
}

/** Pareja encontrada: un "pop" satisfactorio (Pares, Dulces). */
export function playMatch(): Promise<void> {
  return playSfx('match');
}

/** Racha/combo: algo se está acumulando. */
export function playCombo(): Promise<void> {
  return playSfx('combo');
}

/** La fanfarria grande, para GameEndScreen cuando el resultado es bueno. */
export function playNivelCompleto(): Promise<void> {
  return playSfx('nivelCompleto');
}

/** Una pieza/carta aterriza, en Caída. */
export function playCaidaPieza(): Promise<void> {
  return playSfx('caidaPieza');
}

/** Empujoncito al usar una pista de letra (Colmena y similares). */
export function playPista(): Promise<void> {
  return playSfx('pista');
}

/**
 * Secuencia de fin de ronda en los juegos: primero el efecto de
 * acierto/fallo y, cuando termina, la frase correcta en inglés a
 * velocidad normal (si autoAudio está activo).
 *
 * Se puede cancelar en cualquier punto llamando a stop(): el id que
 * playSfx() ya fijó (stop() corre dentro de ella) queda viejo y la voz
 * nunca llega a sonar. Así "avanzar de ronda" cancela SFX y voz con el
 * mismo mecanismo que ya cancela un salto en la sesión de estudio.
 */
export async function playRoundResult(
  correct: boolean,
  phrasePath: string | null,
  autoAudio: boolean
): Promise<void> {
  const key: SfxKey = correct ? 'success' : 'fail';
  await playSfx(key);
  const miId = frase.reproduccionId;
  await esperarSfx(key);
  if (!autoAudio || miId !== frase.reproduccionId) return;
  await play(phrasePath);
}

/**
 * Igual que playRoundResult, pero SIEMPRE reproduce la frase completa en
 * inglés y luego en español al terminar el efecto, sin mirar "Audio
 * automático": para Colmena, donde oír cómo se dice correctamente
 * importa tanto si acertaste la ronda como si no.
 *
 * Si algo corta la reproducción entre el SFX y el inglés, o entre el
 * inglés y el español (avanzar de ronda, salir), no sigue: nunca deja
 * sonando la voz de una ronda que el usuario ya dejó atrás.
 */
export async function playRoundResultBilingue(
  correct: boolean,
  phraseEn: string | null,
  phraseEs: string | null
): Promise<void> {
  const key: SfxKey = correct ? 'success' : 'fail';
  await playSfx(key);
  const miId = frase.reproduccionId;
  await esperarSfx(key);
  if (miId !== frase.reproduccionId) return;

  if (phraseEn) {
    const antes = frase.reproduccionId;
    const sonó = await playAndWait(phraseEn);
    if (!sonó || frase.reproduccionId !== antes + 1) return;
  }
  if (phraseEs) {
    await playAndWait(phraseEs);
  }
}

/**
 * Reproductores que viven fuera de este archivo (hoy, el capítulo de
 * Lecturas) y necesitan enterarse de un corte total. Cada uno se registra
 * con su propia función de corte al montar y se quita al desmontar;
 * detenerTodo() las llama todas. audio.ts no necesita saber qué son.
 */
const otrosReproductores = new Set<() => void>();

export function registrarCorte(cortar: () => void): () => void {
  otrosReproductores.add(cortar);
  return () => otrosReproductores.delete(cortar);
}

/**
 * El corte total: frase, SFX, cualquier secuencia en curso (playSequence y
 * sleep ya revisan reproduccionId, así que no esperan su duración completa)
 * y todo lo que se haya registrado aparte con registrarCorte(). La música de
 * fondo NO se toca aquí: tiene su propio volumen por pantalla en music.ts.
 */
export function detenerTodo(): void {
  stop();
  for (const cortar of otrosReproductores) {
    try {
      cortar();
    } catch {
      // Un reproductor roto no puede tumbar el corte de los demás.
    }
  }
}

export function stop(): void {
  // Invalida cualquier reproducción de frase en camino (en la cola o a
  // medio resolver): al llegar a su turno se va a encontrar con un id
  // viejo y va a abortar sin tocar el player.
  frase.reproduccionId++;
  try {
    frase.player?.pause();
  } catch {
    /* sin consecuencia */
  }
  if (frase.player) marcar(frase.player, { playing: false, arrancando: false });
  // También corta los efectos: "avanzar" o salir de pantalla no debe
  // dejar un SFX terminando de sonar de fondo (solo los que pueden estar sonando).
  pausarEfectosVivos();
}

/** Libera el player nativo. Se llama al salir de la sesión de estudio: la próxima empieza con la racha en 1. */
export function releaseAudio(): void {
  reiniciaRacha();
  frase.reproduccionId++;
  try {
    frase.player?.pause();
  } catch {
    /* sin consecuencia */
  }
  if (frase.player) soltar(frase.player);
  try {
    frase.player?.remove();
  } catch {
    /* sin consecuencia */
  }
  liberarEfectos();
  frase.player = null;
  frase.currentPath = null;
  frase.fuente = null;
  media.invalidate();
}

/**
 * Reproduce una secuencia con pausas. Lo usa el Modo Oído (P-09):
 * inglés, pausa, español, pausa.
 *
 * Cada paso espera a que su audio TERMINE de sonar (playAndWait) antes
 * de arrancar su pausa: la pausa empieza cuando termina el audio,
 * nunca antes. Sin esto, una frase más larga que su pausa quedaba
 * cortada por la siguiente.
 *
 * `onStep`, si viene, se llama justo antes de reproducir cada paso con
 * su índice — lo usa P-09 para mostrar "Repetición X/3" y resaltar el
 * idioma que suena.
 */
export async function playSequence(
  steps: { path: string | null; pauseMs: number }[],
  shouldContinue: () => boolean,
  onStep?: (index: number) => void
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    if (!shouldContinue()) return;
    onStep?.(i);
    const sonó = await playAndWait(steps[i]!.path);
    // stop()/detenerTodo() ya cortó el player mientras sonaba este paso:
    // no sigas a la pausa ni al siguiente paso.
    if (!shouldContinue() || !sonó) return;
    const generacionPaso = frase.reproduccionId;
    await sleep(steps[i]!.pauseMs, shouldContinue);
    // La pausa terminó por su cuenta, pero algo cortó el audio mientras
    // esperaba (reproduccionId cambió): no avances al siguiente paso.
    if (!shouldContinue() || frase.reproduccionId !== generacionPaso) return;
  }
}

/**
 * Espera `ms`, o menos si `shouldContinue()` se apaga o si algo más tocó el
 * audio mientras tanto (reproduccionId cambió). Así una pausa entre pasos de
 * playSequence no se queda esperando su duración completa después de un
 * detenerTodo() que la pantalla que llamó a playSequence todavía no reflejó
 * en su propio shouldContinue (por ejemplo, el corte global de App.tsx).
 */
function sleep(ms: number, shouldContinue: () => boolean): Promise<void> {
  const miGeneracion = frase.reproduccionId;
  return new Promise((resolve) => {
    const step = 100;
    let waited = 0;
    const tick = setInterval(() => {
      waited += step;
      if (waited >= ms || !shouldContinue() || frase.reproduccionId !== miGeneracion) {
        clearInterval(tick);
        resolve();
      }
    }, step);
  });
}
export type { SfxPackId } from '@/services/audio/paquetesSfx';
export {
  guardaPaqueteDevPreferido,
  paqueteSfxActual,
  reiniciaRacha,
  setPaqueteSfx,
  setSfxEnabled,
} from '@/services/audio/efectos';
export { initAudio } from '@/services/audio/estado';
export {
  alReproducir,
  generacionActual,
  isPlaying,
  pauseFrase,
  play,
  playAndWait,
  playSlow,
  progresoFrase,
  resumeFrase,
  saltarFrase,
  waitUntilDone,
  type ArranqueFrase,
  type OpcionesReproduccion,
} from '@/services/audio/reproductor';
