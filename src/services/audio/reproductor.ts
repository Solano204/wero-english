import { createAudioPlayer } from 'expo-audio';
import * as media from '@/services/media';
import * as music from '@/services/musica';
import { INTERVALO_ESTADO_MS, estados, marcar, posicionDe, soltar, suena, vigilar } from './estadoReproductor';
import {
  ARRANQUE_TIMEOUT_MS,
  FIN_MARGEN_MS,
  FIN_TIMEOUT_SIN_DURACION_MS,
  POLL_MS,
  TOPE_ABSOLUTO_MS,
  TOPE_NATIVO_MS,
  conTope,
  frase,
  initAudio,
} from './estado';

/** El reproductor de frases: reproducir con cola y token, esperar el fin, pausar, reanudar y saltar. */

/** Una frase acaba de arrancar. La usa la onda de voz de Estudio; el audio no depende de ella. */
export interface ArranqueFrase {
  ruta: string;
  rate: number;
}

const oyentesFrase = new Set<(e: ArranqueFrase) => void>();

/** Avisa cada vez que una frase arranca (y solo entonces). Devuelve cómo dejar de escuchar. */
export function alReproducir(oyente: (e: ArranqueFrase) => void): () => void {
  oyentesFrase.add(oyente);
  return () => {
    oyentesFrase.delete(oyente);
  };
}

function avisarReproduccion(ruta: string, rate: number): void {
  for (const oyente of oyentesFrase) {
    try {
      oyente({ ruta, rate });
    } catch {
      // Un oyente roto no puede tumbar el audio.
    }
  }
}

/**
 * Resuelve, crea o reutiliza el player y reproduce a la velocidad pedida.
 *
 * Dos protecciones contra toques rápidos (p. ej. "Saltar" repetido):
 *
 * 1. Token: si mientras esta llamada esperaba (resolve, initAudio) llegó
 *    una más nueva, se aborta sin tocar el player. Así de un salto de
 *    diez toques solo la última tarjeta llega a sonar (o ninguna).
 * 2. Cola: el trabajo real (resolver, crear o reutilizar el player,
 *    reproducir) se encadena, nunca corre en paralelo con otra llamada.
 *    Sin esto, dos createAudioPlayer() casi simultáneos podían dejar el
 *    anterior sonando sin nadie que lo pausara ni lo liberara: voces
 *    encimadas y, a la larga, el crash por memoria nativa reportado.
 *
 * La velocidad se fija SIEMPRE, se reutilice o se cree el player: es lo
 * que evita que "Lento" se quede pegado al volver a "Escuchar".
 */
function reproducir(relPath: string | null, rate: number): Promise<boolean> {
  if (!relPath) {
    if (__DEV__) console.warn('[audio] play() llamado con relPath null');
    return Promise.resolve(false);
  }

  const miId = ++frase.reproduccionId;
  let resultado = false;

  const paso = async () => {
    // Todo el paso va en un solo try/catch: si algo truena (incluso
    // media.resolve), la cola sigue viva para la próxima reproducción.
    // Un solo throw sin atrapar aquí dejaría `colaFrase` rechazada para
    // siempre y ningún audio de frase volvería a sonar en la sesión.
    try {
      if (miId !== frase.reproduccionId) return; // ya hay un toque más nuevo

      const resolved = await media.resolve(relPath);
      if (miId !== frase.reproduccionId) return; // se saltó mientras resolvía

      if (!resolved) {
        if (__DEV__) console.warn('[audio] media.resolve() no encontró el archivo', relPath);
        return;
      }

      await conTope(initAudio(), TOPE_NATIVO_MS, undefined);
      if (miId !== frase.reproduccionId) return; // se saltó durante initAudio

      if (frase.player && frase.currentPath === relPath) {
        // Se reutiliza el mismo player: se detiene y rebobina antes de
        // tocarle la velocidad o la posición.
        try {
          frase.player.pause();
        } catch {
          /* sin consecuencia */
        }
        try {
          // Con tope: un seekTo nativo que no vuelve dejaba la cola
          // atorada y ninguna frase volvía a sonar en la sesión.
          await conTope(frase.player.seekTo(0), TOPE_NATIVO_MS, undefined);
        } catch {
          // Si el dispositivo no puede rebobinar, se reproduce igual.
        }
        marcar(frase.player, { playing: false, currentTime: 0, arrancando: false });
      } else {
        // Se pausa antes de soltarlo: remove() sin pausar puede dejar
        // el sonido anterior terminando de salir mientras el nuevo ya
        // empezó, que es justo el "voz encimada" reportado.
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
        // Empaquetado: se le pasa el módulo de require() tal cual, igual que
        // en darenow/app. Resolverlo primero a un `uri` vía Asset.downloadAsync()
        // (como hacía antes) depende de bajar el archivo desde el packager y
        // fallaba en silencio: el player se creaba con la URL del bundler en
        // vez de un archivo local, y no sonaba nada.
        frase.player = createAudioPlayer(
          resolved.kind === 'bundled' ? resolved.module : { uri: resolved.uri },
          { updateInterval: INTERVALO_ESTADO_MS }
        );
        vigilar(frase.player);
        frase.currentPath = relPath;
      }

      if (miId !== frase.reproduccionId) return; // se saltó justo antes de sonar

      try {
        // 'high': corrige el tono al bajar la velocidad, para que "Lento"
        // no suene grave además de lento.
        frase.player.setPlaybackRate(rate, 'high');
      } catch {
        // Si el dispositivo no soporta cambiar la velocidad, suena normal.
      }

      frase.player.play();
      marcar(frase.player, { arrancando: true });
      resultado = true;
      avisarReproduccion(relPath, rate);
      // Ducking: la música se agacha mientras suena esta voz y se
      // recupera sola cuando isPlaying() diga que ya no hay nada
      // sonando en el player de frases (por fin natural o por stop()).
      void music.duck(true);
      void waitUntilDone().then(() => music.duck(false));
    } catch (err) {
      if (__DEV__) console.warn('[audio] no se pudo reproducir', relPath, err);
    }
  };

  // Cada paso de la cola lleva su propio tope: si un await nativo no
  // vuelve, la cola sigue con la próxima reproducción en vez de quedarse
  // atorada el resto de la sesión.
  frase.colaFrase = frase.colaFrase.then(() => conTope(paso(), TOPE_ABSOLUTO_MS, undefined));

  // Y quien llamó a play()/playSlow()/playAndWait() recibe respuesta
  // aunque la cola traiga pasos anteriores atorados.
  return conTope(frase.colaFrase.then(() => resultado), TOPE_ABSOLUTO_MS, false);
}

/** Reproduce siempre a velocidad normal (1.0). */
export function play(relPath: string | null): Promise<boolean> {
  return reproducir(relPath, 1.0);
}

/** Reproduce siempre a velocidad reducida. Para el modo lento de Cázala y P-10. */
export function playSlow(relPath: string | null, rate = 0.7): Promise<boolean> {
  return reproducir(relPath, rate);
}

/**
 * ¿Está sonando algo ahorita?
 *
 * Lo usa la tarjeta para no dejar pasar a la siguiente a media
 * reproducción. Sin esto, tocar "siguiente" tres veces seguidas deja
 * tres audios encimados y el usuario oye el primero mientras ve la
 * cuarta frase, que fue exactamente lo que pasó en pruebas.
 */
export function isPlaying(): boolean {
  // Del último aviso del player, no de `player.playing`: esa lectura
  // bloquea el hilo de JS hasta que contesta el de UI (ver `vigilar`).
  return suena(frase.player);
}

/**
 * Generación actual del token de reproducción de frases (sube en cada
 * play()/playSlow()/stop()). La usa el modo "Repetir" de P-10 para
 * darse cuenta de que otro botón tomó el player mientras esperaba y
 * apagarse solo, en vez de competir por el audio.
 */
export function generacionActual(): number {
  return frase.reproduccionId;
}

/**
 * ¿Se le acaba de dar play() y el player todavía no avisa que suena? Es la
 * señal de "está por arrancar", no de "ya terminó": un audio que YA
 * terminó no queda marcado como arrancando, así que esto evita meter una
 * espera muerta de hasta arranqueTimeoutMs en algo como "Siguiente"
 * cuando el audio ya se acabó hace rato.
 */
function pareceAPuntoDeArrancar(): boolean {
  const e = frase.player ? estados.get(frase.player) : undefined;
  return !isPlaying() && (e?.arrancando ?? false);
}

/**
 * Cuánto se espera, como mucho, a que termine lo que suena: su duración
 * (a la velocidad a la que va) más FIN_MARGEN_MS. Sin duración conocida,
 * FIN_TIMEOUT_SIN_DURACION_MS.
 */
function topeFin(finTimeoutMs?: number): number {
  if (finTimeoutMs !== undefined) return finTimeoutMs;
  const e = frase.player ? estados.get(frase.player) : undefined;
  if (!e || e.duration <= 0) return FIN_TIMEOUT_SIN_DURACION_MS;
  return (e.duration * 1000) / e.rate + FIN_MARGEN_MS;
}

/**
 * Espera a que el player REALMENTE arranque (si acaba de arrancar y
 * el nativo aún no lo refleja, hasta arranqueTimeoutMs) y luego a que
 * termine de sonar. Se corta de inmediato si el token de reproducción
 * cambia mientras espera: alguien más (otro play(), otro stop()) tomó
 * el player y ya no hay nada que esperar aquí.
 */
async function esperaReproduccion(
  miId: number,
  arranqueTimeoutMs: number,
  finTimeoutMs?: number
): Promise<void> {
  const vigente = () => frase.reproduccionId === miId;

  if (pareceAPuntoDeArrancar()) {
    const t0 = Date.now();
    while (pareceAPuntoDeArrancar() && vigente() && Date.now() - t0 < arranqueTimeoutMs) {
      await new Promise((r) => setTimeout(r, 30));
    }
  }
  if (!vigente()) return;

  // El tope se recalcula en cada vuelta: la duración puede llegar en un
  // aviso del player después de que ya empezó a sonar.
  const t1 = Date.now();
  while (isPlaying() && vigente() && Date.now() - t1 < topeFin(finTimeoutMs)) {
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/**
 * Tope de toda una espera (arranque + fin) por si el bucle de arriba se
 * quedara sin turno: arranque, duración (o el tope sin duración) y el
 * margen. Es el Promise.race que garantiza que ninguna espera de audio de
 * un juego se quede colgada.
 */
function topeEspera(arranqueTimeoutMs: number, finTimeoutMs?: number): number {
  return arranqueTimeoutMs + topeFin(finTimeoutMs);
}

export interface OpcionesReproduccion {
  /** 1.0 = velocidad normal. */
  rate?: number;
  /** Cuánto esperar a que el audio arranque antes de darlo por perdido. */
  arranqueTimeoutMs?: number;
}

/**
 * Reproduce y no resuelve hasta que el audio TERMINÓ de sonar de
 * verdad: a diferencia de play(), que solo espera a que se le dé
 * play() al player, esta espera arranque real + fin real. Es lo que
 * necesita una secuencia (Modo Oído) para no cortar una frase larga
 * con la siguiente.
 *
 * Cancelable con el mismo token que play()/playSlow()/stop(): si
 * alguien más reproduce algo mientras espera, resuelve de inmediato en
 * vez de seguir bloqueando.
 */
export async function playAndWait(
  relPath: string | null,
  opciones: OpcionesReproduccion = {}
): Promise<boolean> {
  const sonó = await reproducir(relPath, opciones.rate ?? 1.0);
  if (!sonó) return false;
  const arranque = opciones.arranqueTimeoutMs ?? ARRANQUE_TIMEOUT_MS;
  await conTope(esperaReproduccion(frase.reproduccionId, arranque), topeEspera(arranque), undefined);
  return true;
}

/**
 * Se resuelve cuando el audio actual termina de sonar. Antes solo
 * miraba isPlaying() una vez: si se llamaba justo después de play(),
 * el player todavía no había arrancado y salía sin esperar nada. Ahora
 * espera arranque real y luego fin real, igual que playAndWait().
 */
export async function waitUntilDone(timeoutMs?: number): Promise<void> {
  if (!frase.player) return;
  await conTope(
    esperaReproduccion(frase.reproduccionId, ARRANQUE_TIMEOUT_MS, timeoutMs),
    topeEspera(ARRANQUE_TIMEOUT_MS, timeoutMs),
    undefined
  );
}

/**
 * Pausa la frase sin cancelarla: NO toca reproduccionId, así que
 * resumeFrase() puede seguir donde iba. stop() es el que cancela.
 */
export function pauseFrase(): void {
  try {
    frase.player?.pause();
  } catch {
    /* sin consecuencia */
  }
  if (frase.player) marcar(frase.player, { playing: false, arrancando: false });
  // La música vuelve mientras la voz está en pausa.
  void music.duck(false);
}

/**
 * Reanuda la frase pausada donde iba. Devuelve false si ya no hay
 * player o si no pudo arrancar (nadie sonando, nada que agachar).
 */
export function resumeFrase(): boolean {
  if (!frase.player) return false;
  try {
    frase.player.play();
  } catch {
    return false;
  }
  marcar(frase.player, { arrancando: true });
  void music.duck(true);
  void esperarFinReanudado(frase.reproduccionId).then(() => music.duck(false));
  return true;
}

/**
 * Espera a que la frase reanudada termine para subir la música. Tras
 * play() el estado "playing" tarda un instante en reflejarse, y aquí
 * currentTime ya no es 0, así que waitUntilDone() no esperaría el
 * arranque y creería que ya terminó. Si stop() o una frase nueva toman
 * el player (cambia el token) sale de inmediato: la música no se queda
 * agachada esperando el timeout.
 */
async function esperarFinReanudado(miId: number): Promise<void> {
  const t0 = Date.now();
  while (!isPlaying() && frase.reproduccionId === miId && Date.now() - t0 < ARRANQUE_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 30));
  }
  if (frase.reproduccionId === miId) await waitUntilDone();
}

/**
 * Lleva la frase que suena (o está en pausa) a `seg` segundos, sin cambiar si suena o no. No toca `reproduccionId`: es
 * el mismo audio, solo que desde otro punto. La usa la lectura acompañada al tocar una oración. Devuelve false si no hay
 * nada cargado o el dispositivo no puede moverse.
 */
export async function saltarFrase(seg: number): Promise<boolean> {
  if (!frase.player) return false;
  try {
    // Con tope, como el resto de las llamadas nativas: si el player no contesta, la lectura sigue sin moverse.
    return await conTope(frase.player.seekTo(Math.max(0, seg)).then(() => true), TOPE_NATIVO_MS, false);
  } catch {
    return false;
  }
}

/** Posición y duración de la frase actual, en segundos. */
export function progresoFrase(): { pos: number; dur: number } {
  // La onda, el karaoke y la lectura la leen cada 50 ms: sale del último
  // aviso del player más lo que avanzó desde entonces, nunca de
  // `currentTime`/`duration` (bloquean el hilo de JS, ver `vigilar`).
  const e = frase.player ? estados.get(frase.player) : undefined;
  return e ? { pos: posicionDe(e), dur: e.duration } : { pos: 0, dur: 0 };
}
