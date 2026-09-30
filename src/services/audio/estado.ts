import { setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { cargaPaqueteDevGuardado } from './efectos';

/**
 * El estado del reproductor de frases, compartido por reproductor.ts y la fachada (services/audio.ts).
 * Es un objeto y no variables sueltas porque un `let` exportado no se puede reasignar desde otro módulo.
 */
export const frase: {
  /** Un solo player reutilizado en vez de uno por sonido (ver services/audio.ts). */
  player: AudioPlayer | null;
  ready: boolean;
  currentPath: string | null;
  /**
   * Token de reproducción vigente. Cada play()/playSlow() de frase saca
   * uno nuevo; si al llegar a tocar el player el suyo ya no es el vigente
   * (llegó un salto más nuevo mientras esperaba), aborta sin tocar nada.
   * stop() también lo avanza, para invalidar lo que esté en camino.
   */
  reproduccionId: number;
  /**
   * Cola de reproducción de frases. Encadenar sobre esta promesa garantiza
   * que nunca haya dos createAudioPlayer()/play() de frase en el aire a la
   * vez: la siguiente reproducción espera a que la anterior termine de
   * tocar el player (aunque haya abortado) antes de empezar la suya.
   */
  colaFrase: Promise<void>;
} = {
  player: null,
  ready: false,
  currentPath: null,
  reproduccionId: 0,
  colaFrase: Promise.resolve(),
};

// Cuánto tarda como mucho el player en pasar de play() a playing=true.
// expo-audio no lo marca en el mismo tick: hay una carga de por medio.
export const ARRANQUE_TIMEOUT_MS = 1500;
// Colchón sobre la duración real, por si el reporte del player se queda
// corto (metadata imprecisa, primer frame que tarda, etc.).
export const FIN_MARGEN_MS = 2000;
// Si no se conoce la duración (duration <= 0), tope duro razonable.
export const FIN_TIMEOUT_SIN_DURACION_MS = 15000;
export const POLL_MS = 60;
/** Tope de un await nativo suelto (initAudio, seekTo): si no vuelve, se sigue sin él. */
export const TOPE_NATIVO_MS = 1500;

/**
 * Tope absoluto de un paso de la cola de frases: pase lo que pase (un
 * await nativo que nunca resuelve, `colaFrase` atascada por una llamada
 * anterior), quien espera un play()/playSlow() SIEMPRE recibe una
 * respuesta en vez de quedarse colgado. Las esperas de fin (playAndWait,
 * waitUntilDone) llevan además su propio tope por duración: ver topeEspera.
 */
export const TOPE_ABSOLUTO_MS = 20000;

export function conTope<T>(promesa: Promise<T>, ms: number, siExpira: T): Promise<T> {
  let vencido: ReturnType<typeof setTimeout>;
  const tope = new Promise<T>((resolve) => {
    vencido = setTimeout(() => resolve(siExpira), ms);
  });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(vencido));
}

export async function initAudio(): Promise<void> {
  if (frase.ready) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'doNotMix',
  });
  await cargaPaqueteDevGuardado();
  frase.ready = true;
  // La precarga completa de los ~90 archivos de los 4 paquetes se dejó de hacer aquí: con
  // variantes y escalera, precargar todo el catálogo al arrancar es carga de más que nadie
  // pide de una. Cada efecto crea su player la primera vez que de verdad suena (mismo costo
  // que antes tenía el primer toque de cada clave, ahora también el primero de cada variante).
}
