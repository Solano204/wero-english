import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as media from './media';
import * as music from './music';

/**
 * Reproductor de audio.
 *
 * Un solo player reutilizado en vez de uno por sonido. Crear un player
 * por reproducción filtra memoria nativa y en una sesión de 60 tarjetas
 * con dos toques cada una la app se pone a tirones.
 */

let player: AudioPlayer | null = null;
let ready = false;
let currentPath: string | null = null;

/**
 * Token de reproducción vigente. Cada play()/playSlow() de frase saca
 * uno nuevo; si al llegar a tocar el player el suyo ya no es el vigente
 * (llegó un salto más nuevo mientras esperaba), aborta sin tocar nada.
 * stop() también lo avanza, para invalidar lo que esté en camino.
 */
let reproduccionId = 0;

/**
 * Cola de reproducción de frases. Encadenar sobre esta promesa garantiza
 * que nunca haya dos createAudioPlayer()/play() de frase en el aire a la
 * vez: la siguiente reproducción espera a que la anterior termine de
 * tocar el player (aunque haya abortado) antes de empezar la suya.
 */
let colaFrase: Promise<void> = Promise.resolve();

/* ---------- efectos cortos ----------
   Canal separado del player de frases: uno reproduce catálogo (rutas
   variables, se resuelven con media.resolve), el otro sonidos fijos
   empaquetados. Mezclarlos en el mismo player forzaría un resolve()
   innecesario cada vez que pasa algo en un juego.

   Cada efecto tiene SU PROPIO player, creado una sola vez y reutilizado
   (máximo un player por efecto): así "tap" y "match" nunca se pisan
   entre sí, y no hay que crear un player nativo en cada toque. */
type SfxKey =
  | 'success'
  | 'fail'
  | 'tap'
  | 'match'
  | 'combo'
  | 'nivelCompleto'
  | 'caidaPieza'
  | 'pista';

/** Los 4 juegos de sonido: D es el actual (sin variantes ni escalera); A/B/C son los nuevos. */
export type SfxPackId = 'A' | 'B' | 'C' | 'D';

/**
 * `success` tiene 5 alturas (escalera de aciertos) × 3 variantes; `fail`/`tap`/`match` solo 3
 * variantes; el resto, un solo archivo. Todos los `require()` son literales (Metro no permite
 * una ruta calculada), así que este catálogo es largo mecánicamente, no complicado.
 */
interface FuentesPaquete {
  success: readonly (readonly number[])[]; // [escalon 1..5][variante 0..2]
  fail: readonly number[];
  tap: readonly number[];
  match: readonly number[];
  combo: number;
  nivelCompleto: number;
  caidaPieza: number;
  pista: number;
}

const unaVoz = (m: number): readonly number[] => [m, m, m];
const unaAltura = (m: number): readonly number[] => [m, m, m];

const PAQUETE_D: FuentesPaquete = {
  // D no tenía variantes ni escalera: los 5×3 huecos de `success` apuntan al mismo archivo de siempre.
  success: [1, 2, 3, 4, 5].map(() => unaAltura(require('../../assets/sfx/success.wav'))),
  fail: unaVoz(require('../../assets/sfx/fail.wav')),
  tap: unaVoz(require('../../assets/sfx/tap.wav')),
  match: unaVoz(require('../../assets/sfx/match.wav')),
  combo: require('../../assets/sfx/combo.wav'),
  nivelCompleto: require('../../assets/sfx/nivel_completo.wav'),
  caidaPieza: require('../../assets/sfx/caida_pieza.wav'),
  pista: require('../../assets/sfx/pista.wav'),
};

const PAQUETE_A: FuentesPaquete = {
  success: [
    [require('../../assets/sfx/a/success_h1_v1.wav'), require('../../assets/sfx/a/success_h1_v2.wav'), require('../../assets/sfx/a/success_h1_v3.wav')],
    [require('../../assets/sfx/a/success_h2_v1.wav'), require('../../assets/sfx/a/success_h2_v2.wav'), require('../../assets/sfx/a/success_h2_v3.wav')],
    [require('../../assets/sfx/a/success_h3_v1.wav'), require('../../assets/sfx/a/success_h3_v2.wav'), require('../../assets/sfx/a/success_h3_v3.wav')],
    [require('../../assets/sfx/a/success_h4_v1.wav'), require('../../assets/sfx/a/success_h4_v2.wav'), require('../../assets/sfx/a/success_h4_v3.wav')],
    [require('../../assets/sfx/a/success_h5_v1.wav'), require('../../assets/sfx/a/success_h5_v2.wav'), require('../../assets/sfx/a/success_h5_v3.wav')],
  ],
  fail: [require('../../assets/sfx/a/fail_1.wav'), require('../../assets/sfx/a/fail_2.wav'), require('../../assets/sfx/a/fail_3.wav')],
  tap: [require('../../assets/sfx/a/tap_1.wav'), require('../../assets/sfx/a/tap_2.wav'), require('../../assets/sfx/a/tap_3.wav')],
  match: [require('../../assets/sfx/a/match_1.wav'), require('../../assets/sfx/a/match_2.wav'), require('../../assets/sfx/a/match_3.wav')],
  combo: require('../../assets/sfx/a/combo.wav'),
  nivelCompleto: require('../../assets/sfx/a/nivel_completo.wav'),
  caidaPieza: require('../../assets/sfx/a/caida_pieza.wav'),
  pista: require('../../assets/sfx/a/pista.wav'),
};

const PAQUETE_B: FuentesPaquete = {
  success: [
    [require('../../assets/sfx/b/success_h1_v1.wav'), require('../../assets/sfx/b/success_h1_v2.wav'), require('../../assets/sfx/b/success_h1_v3.wav')],
    [require('../../assets/sfx/b/success_h2_v1.wav'), require('../../assets/sfx/b/success_h2_v2.wav'), require('../../assets/sfx/b/success_h2_v3.wav')],
    [require('../../assets/sfx/b/success_h3_v1.wav'), require('../../assets/sfx/b/success_h3_v2.wav'), require('../../assets/sfx/b/success_h3_v3.wav')],
    [require('../../assets/sfx/b/success_h4_v1.wav'), require('../../assets/sfx/b/success_h4_v2.wav'), require('../../assets/sfx/b/success_h4_v3.wav')],
    [require('../../assets/sfx/b/success_h5_v1.wav'), require('../../assets/sfx/b/success_h5_v2.wav'), require('../../assets/sfx/b/success_h5_v3.wav')],
  ],
  fail: [require('../../assets/sfx/b/fail_1.wav'), require('../../assets/sfx/b/fail_2.wav'), require('../../assets/sfx/b/fail_3.wav')],
  tap: [require('../../assets/sfx/b/tap_1.wav'), require('../../assets/sfx/b/tap_2.wav'), require('../../assets/sfx/b/tap_3.wav')],
  match: [require('../../assets/sfx/b/match_1.wav'), require('../../assets/sfx/b/match_2.wav'), require('../../assets/sfx/b/match_3.wav')],
  combo: require('../../assets/sfx/b/combo.wav'),
  nivelCompleto: require('../../assets/sfx/b/nivel_completo.wav'),
  caidaPieza: require('../../assets/sfx/b/caida_pieza.wav'),
  pista: require('../../assets/sfx/b/pista.wav'),
};

const PAQUETE_C: FuentesPaquete = {
  success: [
    [require('../../assets/sfx/c/success_h1_v1.wav'), require('../../assets/sfx/c/success_h1_v2.wav'), require('../../assets/sfx/c/success_h1_v3.wav')],
    [require('../../assets/sfx/c/success_h2_v1.wav'), require('../../assets/sfx/c/success_h2_v2.wav'), require('../../assets/sfx/c/success_h2_v3.wav')],
    [require('../../assets/sfx/c/success_h3_v1.wav'), require('../../assets/sfx/c/success_h3_v2.wav'), require('../../assets/sfx/c/success_h3_v3.wav')],
    [require('../../assets/sfx/c/success_h4_v1.wav'), require('../../assets/sfx/c/success_h4_v2.wav'), require('../../assets/sfx/c/success_h4_v3.wav')],
    [require('../../assets/sfx/c/success_h5_v1.wav'), require('../../assets/sfx/c/success_h5_v2.wav'), require('../../assets/sfx/c/success_h5_v3.wav')],
  ],
  fail: [require('../../assets/sfx/c/fail_1.wav'), require('../../assets/sfx/c/fail_2.wav'), require('../../assets/sfx/c/fail_3.wav')],
  tap: [require('../../assets/sfx/c/tap_1.wav'), require('../../assets/sfx/c/tap_2.wav'), require('../../assets/sfx/c/tap_3.wav')],
  match: [require('../../assets/sfx/c/match_1.wav'), require('../../assets/sfx/c/match_2.wav'), require('../../assets/sfx/c/match_3.wav')],
  combo: require('../../assets/sfx/c/combo.wav'),
  nivelCompleto: require('../../assets/sfx/c/nivel_completo.wav'),
  caidaPieza: require('../../assets/sfx/c/caida_pieza.wav'),
  pista: require('../../assets/sfx/c/pista.wav'),
};

const PAQUETES: Record<SfxPackId, FuentesPaquete> = { A: PAQUETE_A, B: PAQUETE_B, C: PAQUETE_C, D: PAQUETE_D };

let paqueteActivo: SfxPackId = 'D';
/** Solo __DEV__: el Muestrario de sonidos la usa para probar un paquete sin reiniciar la app. */
export function setPaqueteSfx(id: SfxPackId): void {
  if (paqueteActivo === id) return;
  paqueteActivo = id;
  // Los players ya creados apuntan a los archivos del paquete anterior: se sueltan para que el
  // próximo playSfx() los cree de nuevo con la fuente correcta.
  for (const p of sfxPlayers.values()) {
    try {
      p.remove();
    } catch {
      /* sin consecuencia */
    }
  }
  sfxPlayers.clear();
}
export function paqueteSfxActual(): SfxPackId {
  return paqueteActivo;
}

/** Solo __DEV__: dónde el Muestrario de sonidos guarda qué paquete se probó por última vez. */
const CLAVE_PAQUETE_DEV = 'wero:dev:paquete_sfx';

async function cargaPaqueteDevGuardado(): Promise<void> {
  if (!__DEV__) return;
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_PAQUETE_DEV);
    if (guardado === 'A' || guardado === 'B' || guardado === 'C' || guardado === 'D') paqueteActivo = guardado;
  } catch {
    // Sin lo guardado, se queda en D.
  }
}

/** La usa el Muestrario al tocar "Usar este paquete": lo aplica ya mismo y lo deja guardado para el próximo arranque. */
export async function guardaPaqueteDevPreferido(id: SfxPackId): Promise<void> {
  setPaqueteSfx(id);
  if (!__DEV__) return;
  try {
    await AsyncStorage.setItem(CLAVE_PAQUETE_DEV, id);
  } catch {
    // Se queda aplicado en esta sesión, aunque no se pudiera guardar.
  }
}

let sfxEnabled = true;
/** Cada variante activa (para no repetir la anterior) y, para `success`, el escalón de la racha. */
const ultimaVariante = new Map<SfxKey, number>();
let escalonRacha = 1;
const MAX_ESCALON_RACHA = 5;

/** Al fallar o al empezar una sesión nueva. */
export function reiniciaRacha(): void {
  escalonRacha = 1;
}

/** Una variante 0-2 distinta de la última usada para esa clave (si solo hay una, la repite: no hay de otra). */
function variante(key: SfxKey, total: number): number {
  if (total <= 1) return 0;
  const anterior = ultimaVariante.get(key) ?? -1;
  let v = Math.floor(Math.random() * total);
  if (v === anterior) v = (v + 1) % total;
  ultimaVariante.set(key, v);
  return v;
}

/** Ajuste de tono ±2 % por variante: mismo `setPlaybackRate` que ya usa la voz, pero SIN
 * corrección de tono ('high' es lo que la voz sí necesita para "Lento"): aquí queremos que el
 * tono se mueva un poco con la velocidad, es justo el detune que pide el diseño. */
const DETUNE_MAX = 0.02;
function tasaDetune(): number {
  return 1 + (Math.random() * 2 - 1) * DETUNE_MAX;
}

function fuenteSfx(key: SfxKey): { modulo: number; v: number; escalon: number } {
  const f = PAQUETES[paqueteActivo];
  if (key === 'success') {
    // Este acierto usa el escalón actual; el SIGUIENTE acierto seguido sube uno (tope en el 5.º).
    const escalon = escalonRacha;
    escalonRacha = Math.min(MAX_ESCALON_RACHA, escalonRacha + 1);
    const v = variante('success', 3);
    return { modulo: f.success[escalon - 1]![v]!, v, escalon };
  }
  if (key === 'fail' || key === 'tap' || key === 'match') {
    // Reiniciar aquí (no solo en playFail()) porque playRoundResult()/playRoundResultBilingue()
    // llaman playSfx('fail') directo, sin pasar por playFail().
    if (key === 'fail') reiniciaRacha();
    const lista = f[key];
    const v = variante(key, lista.length);
    return { modulo: lista[v]!, v, escalon: 0 };
  }
  return { modulo: f[key] as number, v: 0, escalon: 0 };
}

// Un player por (clave, variante/escalón) posible, creado bajo demanda: como antes, máximo un
// player nativo por sonido que de verdad se usó, nunca uno por reproducción.
const sfxPlayers = new Map<string, AudioPlayer>();
const sfxUltimaVez = new Map<SfxKey, number>();

/** Toques rápidos no saturan: por debajo de esto, el toque se ignora. */
const SFX_THROTTLE_MS = 60;

/** Interruptor de "sonidos de feedback" en ajustes. */
export function setSfxEnabled(v: boolean): void {
  sfxEnabled = v;
}

function sfxPlayerPara(key: SfxKey, modulo: number, v: number, escalon: number): AudioPlayer {
  const cacheKey = `${paqueteActivo}:${key}:${escalon}:${v}`;
  let p = sfxPlayers.get(cacheKey);
  if (!p) {
    p = createAudioPlayer(modulo);
    sfxPlayers.set(cacheKey, p);
  }
  return p;
}

export async function initAudio(): Promise<void> {
  if (ready) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'doNotMix',
  });
  await cargaPaqueteDevGuardado();
  ready = true;
  // La precarga completa de los ~90 archivos de los 4 paquetes se dejó de hacer aquí: con
  // variantes y escalera, precargar todo el catálogo al arrancar es carga de más que nadie
  // pide de una. Cada efecto crea su player la primera vez que de verdad suena (mismo costo
  // que antes tenía el primer toque de cada clave, ahora también el primero de cada variante).
}

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
    console.warn('[audio] play() llamado con relPath null');
    return Promise.resolve(false);
  }

  const miId = ++reproduccionId;
  let resultado = false;

  colaFrase = colaFrase.then(async () => {
    // Todo el paso va en un solo try/catch: si algo truena (incluso
    // media.resolve), la cola sigue viva para la próxima reproducción.
    // Un solo throw sin atrapar aquí dejaría `colaFrase` rechazada para
    // siempre y ningún audio de frase volvería a sonar en la sesión.
    try {
      if (miId !== reproduccionId) return; // ya hay un toque más nuevo

      const resolved = await media.resolve(relPath);
      if (miId !== reproduccionId) return; // se saltó mientras resolvía

      if (!resolved) {
        console.warn('[audio] media.resolve() no encontró el archivo', relPath);
        return;
      }

      await initAudio();
      if (miId !== reproduccionId) return; // se saltó durante initAudio

      if (player && currentPath === relPath) {
        // Se reutiliza el mismo player: se detiene y rebobina antes de
        // tocarle la velocidad o la posición.
        try {
          player.pause();
        } catch {
          /* sin consecuencia */
        }
        try {
          await player.seekTo(0);
        } catch {
          // Si el dispositivo no puede rebobinar, se reproduce igual.
        }
      } else {
        // Se pausa antes de soltarlo: remove() sin pausar puede dejar
        // el sonido anterior terminando de salir mientras el nuevo ya
        // empezó, que es justo el "voz encimada" reportado.
        try {
          player?.pause();
        } catch {
          /* sin consecuencia */
        }
        try {
          player?.remove();
        } catch {
          /* sin consecuencia */
        }
        // Empaquetado: se le pasa el módulo de require() tal cual, igual que
        // en darenow/app. Resolverlo primero a un `uri` vía Asset.downloadAsync()
        // (como hacía antes) depende de bajar el archivo desde el packager y
        // fallaba en silencio: el player se creaba con la URL del bundler en
        // vez de un archivo local, y no sonaba nada.
        player = createAudioPlayer(
          resolved.kind === 'bundled' ? resolved.module : { uri: resolved.uri }
        );
        currentPath = relPath;
      }

      if (miId !== reproduccionId) return; // se saltó justo antes de sonar

      try {
        // 'high': corrige el tono al bajar la velocidad, para que "Lento"
        // no suene grave además de lento.
        player.setPlaybackRate(rate, 'high');
      } catch {
        // Si el dispositivo no soporta cambiar la velocidad, suena normal.
      }

      player.play();
      resultado = true;
      avisarReproduccion(relPath, rate);
      // Ducking: la música se agacha mientras suena esta voz y se
      // recupera sola cuando isPlaying() diga que ya no hay nada
      // sonando en el player de frases (por fin natural o por stop()).
      void music.duck(true);
      void waitUntilDone().then(() => music.duck(false));
    } catch (err) {
      console.warn('[audio] no se pudo reproducir', relPath, err);
    }
  });

  // Tope absoluto: si `colaFrase` se atora en un await nativo que nunca
  // resuelve, quien llamó a play()/playSlow()/playAndWait() igual recibe
  // una respuesta en vez de quedarse esperando para siempre.
  return conTope(colaFrase.then(() => resultado), TOPE_ABSOLUTO_MS, false);
}

/** Reproduce siempre a velocidad normal (1.0). */
export function play(relPath: string | null): Promise<boolean> {
  return reproducir(relPath, 1.0);
}

/** El player que de verdad sonó la última vez para cada clave: lo que `sfxSuena`/`esperarSfx` miran (con variantes, no siempre es el mismo objeto `AudioPlayer`). */
const ultimoPlayerPorClave = new Map<SfxKey, AudioPlayer>();

async function playSfx(key: SfxKey): Promise<void> {
  if (!sfxEnabled) return;

  const ahora = Date.now();
  if (ahora - (sfxUltimaVez.get(key) ?? 0) < SFX_THROTTLE_MS) return;
  sfxUltimaVez.set(key, ahora);

  try {
    await initAudio();

    // Nunca encimado con la frase: el efecto la corta, no suena junto a ella.
    stop();

    const { modulo, v, escalon } = fuenteSfx(key);
    const p = sfxPlayerPara(key, modulo, v, escalon);
    ultimoPlayerPorClave.set(key, p);
    try {
      await p.seekTo(0);
    } catch {
      // Si no puede rebobinar, suena desde donde iba.
    }
    try {
      // Sin 'high': a diferencia de la voz, aquí SÍ se quiere que el tono
      // se mueva un poco con la velocidad (es el detune de ±2 %).
      p.setPlaybackRate(tasaDetune());
    } catch {
      // Si el dispositivo no lo permite, suena a tono fijo: solo varían timbre/nota.
    }
    p.play();
  } catch (err) {
    console.warn('[audio] no se pudo reproducir el efecto', key, err);
  }
}

function sfxSuena(key: SfxKey): boolean {
  try {
    return Boolean(ultimoPlayerPorClave.get(key)?.playing);
  } catch {
    return false;
  }
}

/** Se resuelve cuando ese efecto termina, o de inmediato si no sonó. */
async function esperarSfx(key: SfxKey, timeoutMs = 2000): Promise<void> {
  const inicio = Date.now();
  // Justo después de play() el estado "playing" puede tardar un
  // instante en reflejarse: sin este margen, esperarSfx podría creer
  // que ya terminó cuando en realidad apenas empezaba.
  await new Promise((r) => setTimeout(r, 30));
  while (sfxSuena(key) && Date.now() - inicio < timeoutMs) {
    await new Promise((r) => setTimeout(r, 40));
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
  const miId = reproduccionId;
  await esperarSfx(key);
  if (!autoAudio || miId !== reproduccionId) return;
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
  const miId = reproduccionId;
  await esperarSfx(key);
  if (miId !== reproduccionId) return;

  if (phraseEn) {
    const antes = reproduccionId;
    const sonó = await playAndWait(phraseEn);
    if (!sonó || reproduccionId !== antes + 1) return;
  }
  if (phraseEs) {
    await playAndWait(phraseEs);
  }
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
  try {
    return Boolean(player?.playing);
  } catch {
    return false;
  }
}

/**
 * Generación actual del token de reproducción de frases (sube en cada
 * play()/playSlow()/stop()). La usa el modo "Repetir" de P-10 para
 * darse cuenta de que otro botón tomó el player mientras esperaba y
 * apagarse solo, en vez de competir por el audio.
 */
export function generacionActual(): number {
  return reproduccionId;
}

// Cuánto tarda como mucho el player en pasar de play() a playing=true.
// expo-audio no lo marca en el mismo tick: hay una carga de por medio.
const ARRANQUE_TIMEOUT_MS = 1500;
// Colchón sobre la duración real, por si el reporte del player se queda
// corto (metadata imprecisa, primer frame que tarda, etc.).
const FIN_MARGEN_MS = 2000;
// Si no se conoce la duración (duration <= 0), tope duro razonable.
const FIN_TIMEOUT_SIN_DURACION_MS = 15000;
const POLL_MS = 60;

/**
 * Tope absoluto de una espera de audio de frase: pase lo que pase (un
 * await nativo que nunca resuelve, `colaFrase` atascada por una llamada
 * anterior), quien espera un play()/playAndWait()/waitUntilDone() SIEMPRE
 * recibe una respuesta en vez de quedarse colgado. Los juegos que avanzan
 * de ronda dependen de esto: nunca deben congelarse por una espera de
 * audio que no vuelve.
 */
const TOPE_ABSOLUTO_MS = 20000;

function conTope<T>(promesa: Promise<T>, ms: number, siExpira: T): Promise<T> {
  let vencido: ReturnType<typeof setTimeout>;
  const tope = new Promise<T>((resolve) => {
    vencido = setTimeout(() => resolve(siExpira), ms);
  });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(vencido));
}

/**
 * ¿currentTime en 0 y sin sonar? Es la señal de "se le acaba de dar
 * play() y el nativo todavía no lo refleja", no de "ya terminó". Un
 * audio que YA terminó se queda con currentTime > 0 (reproducir() solo
 * rebobina a 0 al REUSAR el player para uno nuevo), así que esta
 * distinción es lo que evita meter una espera muerta de hasta
 * arranqueTimeoutMs en algo como "Siguiente" cuando el audio ya se
 * acabó hace rato.
 */
function pareceAPuntoDeArrancar(): boolean {
  return !isPlaying() && (player?.currentTime ?? 0) === 0;
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
  const vigente = () => reproduccionId === miId;

  if (pareceAPuntoDeArrancar()) {
    const t0 = Date.now();
    while (pareceAPuntoDeArrancar() && vigente() && Date.now() - t0 < arranqueTimeoutMs) {
      await new Promise((r) => setTimeout(r, 30));
    }
  }
  if (!vigente()) return;

  // player?.duration es un getter nativo: si el player queda en un
  // estado raro puede tirar en vez de dar 0, y eso dejaría esta espera
  // rechazada sin que nadie limpie su candado (ver waitUntilDone/
  // playAndWait, que ya no dependen de esto porque van con conTope).
  let duracionS = 0;
  try {
    duracionS = player?.duration ?? 0;
  } catch {
    /* sin duración conocida: se usa el tope sin duración de abajo */
  }
  const timeout =
    finTimeoutMs ?? (duracionS > 0 ? duracionS * 1000 + FIN_MARGEN_MS : FIN_TIMEOUT_SIN_DURACION_MS);
  const t1 = Date.now();
  while (isPlaying() && vigente() && Date.now() - t1 < timeout) {
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
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
  await conTope(
    esperaReproduccion(reproduccionId, opciones.arranqueTimeoutMs ?? ARRANQUE_TIMEOUT_MS),
    TOPE_ABSOLUTO_MS,
    undefined
  );
  return true;
}

/**
 * Se resuelve cuando el audio actual termina de sonar. Antes solo
 * miraba isPlaying() una vez: si se llamaba justo después de play(),
 * el player todavía no había arrancado y salía sin esperar nada. Ahora
 * espera arranque real y luego fin real, igual que playAndWait().
 */
export async function waitUntilDone(timeoutMs?: number): Promise<void> {
  if (!player) return;
  await conTope(
    esperaReproduccion(reproduccionId, ARRANQUE_TIMEOUT_MS, timeoutMs),
    TOPE_ABSOLUTO_MS,
    undefined
  );
}

/**
 * Pausa la frase sin cancelarla: NO toca reproduccionId, así que
 * resumeFrase() puede seguir donde iba. stop() es el que cancela.
 */
export function pauseFrase(): void {
  try {
    player?.pause();
  } catch {
    /* sin consecuencia */
  }
  // La música vuelve mientras la voz está en pausa.
  void music.duck(false);
}

/**
 * Reanuda la frase pausada donde iba. Devuelve false si ya no hay
 * player o si no pudo arrancar (nadie sonando, nada que agachar).
 */
export function resumeFrase(): boolean {
  if (!player) return false;
  try {
    player.play();
  } catch {
    return false;
  }
  void music.duck(true);
  void esperarFinReanudado(reproduccionId).then(() => music.duck(false));
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
  while (!isPlaying() && reproduccionId === miId && Date.now() - t0 < ARRANQUE_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 30));
  }
  if (reproduccionId === miId) await waitUntilDone();
}

/**
 * Lleva la frase que suena (o está en pausa) a `seg` segundos, sin cambiar si suena o no. No toca `reproduccionId`: es
 * el mismo audio, solo que desde otro punto. La usa la lectura acompañada al tocar una oración. Devuelve false si no hay
 * nada cargado o el dispositivo no puede moverse.
 */
export async function saltarFrase(seg: number): Promise<boolean> {
  if (!player) return false;
  try {
    await player.seekTo(Math.max(0, seg));
    return true;
  } catch {
    return false;
  }
}

/** Posición y duración de la frase actual, en segundos. */
export function progresoFrase(): { pos: number; dur: number } {
  try {
    return { pos: player?.currentTime ?? 0, dur: player?.duration ?? 0 };
  } catch {
    return { pos: 0, dur: 0 };
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
  reproduccionId++;
  try {
    player?.pause();
  } catch {
    /* sin consecuencia */
  }
  // También corta los efectos: "avanzar" o salir de pantalla no debe
  // dejar un SFX terminando de sonar de fondo.
  for (const p of sfxPlayers.values()) {
    try {
      p.pause();
    } catch {
      /* sin consecuencia */
    }
  }
}

/** Libera el player nativo. Se llama al salir de la sesión de estudio: la próxima empieza con la racha en 1. */
export function releaseAudio(): void {
  reiniciaRacha();
  reproduccionId++;
  try {
    player?.pause();
  } catch {
    /* sin consecuencia */
  }
  try {
    player?.remove();
  } catch {
    /* sin consecuencia */
  }
  for (const p of sfxPlayers.values()) {
    try {
      p.remove();
    } catch {
      /* sin consecuencia */
    }
  }
  sfxPlayers.clear();
  player = null;
  currentPath = null;
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
    const generacionPaso = reproduccionId;
    await sleep(steps[i]!.pauseMs, shouldContinue);
    // La pausa terminó por su cuenta, pero algo cortó el audio mientras
    // esperaba (reproduccionId cambió): no avances al siguiente paso.
    if (!shouldContinue() || reproduccionId !== generacionPaso) return;
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
  const miGeneracion = reproduccionId;
  return new Promise((resolve) => {
    const step = 100;
    let waited = 0;
    const tick = setInterval(() => {
      waited += step;
      if (waited >= ms || !shouldContinue() || reproduccionId !== miGeneracion) {
        clearInterval(tick);
        resolve();
      }
    }, step);
  });
}
