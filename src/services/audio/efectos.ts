import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { estados, marcar, soltar, suena, vigilar } from './estadoReproductor';
import { PAQUETES, type SfxKey, type SfxPackId } from './paquetesSfx';

/* ---------- efectos cortos ----------
   Canal separado del player de frases: uno reproduce catálogo (rutas
   variables, se resuelven con media.resolve), el otro sonidos fijos
   empaquetados. Mezclarlos en el mismo player forzaría un resolve()
   innecesario cada vez que pasa algo en un juego.

   Cada efecto tiene SU PROPIO player, creado una sola vez y reutilizado
   (máximo un player por efecto): así "tap" y "match" nunca se pisan
   entre sí, y no hay que crear un player nativo en cada toque. */

let paqueteActivo: SfxPackId = 'D';
/** Solo __DEV__: el Muestrario de sonidos la usa para probar un paquete sin reiniciar la app. */
export function setPaqueteSfx(id: SfxPackId): void {
  if (paqueteActivo === id) return;
  paqueteActivo = id;
  // Los players ya creados apuntan a los archivos del paquete anterior: se sueltan para que el
  // próximo playSfx() los cree de nuevo con la fuente correcta.
  for (const p of sfxPlayers.values()) {
    soltar(p);
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

export async function cargaPaqueteDevGuardado(): Promise<void> {
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
export function tasaDetune(): number {
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
    vigilar(p);
    sfxPlayers.set(cacheKey, p);
  }
  return p;
}

/** Cuándo se le dio play() por última vez a cada player de efecto: stop() solo pausa los que pueden estar sonando. */
const sfxTocadoEn = new Map<AudioPlayer, number>();
/** Un efecto dura menos que esto; pasado este rato ya no hace falta pausarlo. */
const SFX_VIVO_MS = 3000;

/** El player que de verdad sonó la última vez para cada clave: lo que `esperarSfx` mira (con variantes, no siempre es el mismo objeto `AudioPlayer`). */
const ultimoPlayerPorClave = new Map<SfxKey, AudioPlayer>();

/** Lo que tarda como mucho un efecto en pasar de play() a sonando. */
const SFX_ARRANQUE_MS = 400;

/**
 * Se resuelve cuando ese efecto termina, o de inmediato si no sonó. Mira
 * el estado que avisa el player, nunca `.playing` (que bloquea a JS), y
 * nunca pasa de `timeoutMs`.
 */
export async function esperarSfx(key: SfxKey, timeoutMs = 2000): Promise<void> {
  const inicio = Date.now();
  const p = ultimoPlayerPorClave.get(key);
  if (!p) return;
  // Justo después de play() el aviso de "sonando" tarda un instante:
  // sin esta espera corta se creería que ya terminó cuando apenas empieza.
  while (estados.get(p)?.arrancando && Date.now() - inicio < SFX_ARRANQUE_MS) {
    await new Promise((r) => setTimeout(r, 30));
  }
  while (suena(p) && Date.now() - inicio < timeoutMs) {
    await new Promise((r) => setTimeout(r, 40));
  }
}

/** Sonidos apagados en Ajustes, o el mismo efecto hace menos de SFX_THROTTLE_MS: este toque no suena. */
export function efectoPermitido(key: SfxKey): boolean {
  if (!sfxEnabled) return false;

  const ahora = Date.now();
  if (ahora - (sfxUltimaVez.get(key) ?? 0) < SFX_THROTTLE_MS) return false;
  sfxUltimaVez.set(key, ahora);
  return true;
}

/** El player del efecto (variante y escalón de la racha incluidos), listo para rebobinar y sonar. */
export function prepararEfecto(key: SfxKey): AudioPlayer {
  const { modulo, v, escalon } = fuenteSfx(key);
  const p = sfxPlayerPara(key, modulo, v, escalon);
  ultimoPlayerPorClave.set(key, p);
  return p;
}

export function marcarEfectoTocado(p: AudioPlayer): void {
  sfxTocadoEn.set(p, Date.now());
}

/**
 * Pausa los efectos que pueden estar sonando. Solo esos: cada pause() es una llamada síncrona al hilo
 * de UI, y pausar una docena de players callados en cada toque no sirve de nada.
 */
export function pausarEfectosVivos(): void {
  const ahora = Date.now();
  for (const p of sfxPlayers.values()) {
    if (!suena(p) && ahora - (sfxTocadoEn.get(p) ?? 0) > SFX_VIVO_MS) continue;
    try {
      p.pause();
    } catch {
      /* sin consecuencia */
    }
    marcar(p, { playing: false, arrancando: false });
  }
}

/** Suelta todos los players de efectos (al salir de la sesión de estudio). */
export function liberarEfectos(): void {
  for (const p of sfxPlayers.values()) {
    soltar(p);
    try {
      p.remove();
    } catch {
      /* sin consecuencia */
    }
  }
  sfxPlayers.clear();
  sfxTocadoEn.clear();
  ultimoPlayerPorClave.clear();
}

