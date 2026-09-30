import { AppState } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Música de fondo.
 *
 * Un solo player en loop, separado del de frases y del de efectos
 * (audio.ts): la música no compite con ellos por el mismo canal, solo
 * le cede volumen (ducking) mientras suenan y lo recupera al terminar.
 *
 * expo-audio no necesita nada especial en setAudioModeAsync para que
 * los tres (música, voz, SFX) suenen juntos: cada uno es un
 * AudioPlayer aparte, y varios players del mismo app ya se mezclan por
 * su cuenta. `interruptionMode: 'doNotMix'` en audio.ts (ya configurado
 * ahí con playsInSilentMode) decide cómo nos llevamos con la música de
 * OTRAS apps y con el switch de silencio del teléfono; este archivo no
 * llama setAudioModeAsync de nuevo para no pisar esa configuración.
 */

const PISTAS = {
  app: require('@assets/music/app.mp3'),
  juegos: require('@assets/music/juegos.mp3'),
} as const;

export type Pista = keyof typeof PISTAS;

const CROSSFADE_MS = 600;
const DUCK_FADE_MS = 300;
const FADE_STEP_MS = 30;
const DUCK_FACTOR = 0.2;

let player: AudioPlayer | null = null;
let pistaActual: Pista | null = null;
let habilitada = true;
/** 0..1, el volumen elegido en Ajustes. */
let volumenUsuario = 0.35;
/** 0..1, lo que pone cada pantalla vía useMusicaPantalla (estudio/gramática bajan a 0.4). */
let factorFoco = 1;
let agachada = false;
/** true mientras dura un pausar() explícito (Escuchar/Dictado, etc.). */
let pausadaExplicita = false;
let pausadaPorBackground = false;
let iniciada = false;
/** Token de fundido: uno nuevo invalida cualquiera en curso. */
let fadeId = 0;

function volumenObjetivo(): number {
  const base = volumenUsuario * factorFoco;
  return agachada ? base * DUCK_FACTOR : base;
}

/** Fundido genérico sobre el player actual. */
async function fundir(destino: number, ms: number): Promise<void> {
  if (!player) return;
  const miFade = ++fadeId;
  const inicio = player.volume;
  const pasos = Math.max(1, Math.round(ms / FADE_STEP_MS));

  for (let i = 1; i <= pasos; i++) {
    if (miFade !== fadeId || !player) return; // otro fundido lo reemplazó
    try {
      player.volume = inicio + (destino - inicio) * (i / pasos);
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, FADE_STEP_MS));
  }
}

/** Arranca el servicio. Se llama UNA vez desde la raíz, tras BootScreen. */
export async function iniciar(): Promise<void> {
  if (iniciada) return;
  iniciada = true;
  await setPista('app');
}

/**
 * Cambia de pista con crossfade (~600ms): la que sale y la que entra
 * suenan juntas un instante en vez de haber un hueco de silencio. Si ya
 * es la pista actual, no reinicia nada (solo la retoma si venía en
 * pausa por background, nunca si está en pausadaExplicita).
 */
export async function setPista(pista: Pista): Promise<void> {
  if (!habilitada) {
    pistaActual = pista; // se recuerda para cuando se vuelva a activar
    return;
  }

  if (pistaActual === pista && player) {
    if (!isPlaying() && !pausadaExplicita) {
      try {
        player.play();
      } catch {
        /* sin consecuencia */
      }
    }
    return;
  }

  const viejo = player;
  const miToken = ++fadeId;
  const volViejo = viejo?.volume ?? 0;

  let nuevo: AudioPlayer | null = null;
  try {
    nuevo = createAudioPlayer(PISTAS[pista]);
    nuevo.loop = true;
    nuevo.volume = 0;
    nuevo.play();
  } catch (err) {
    if (__DEV__) console.warn('[music] no se pudo reproducir', pista, err);
    nuevo = null;
  }

  player = nuevo;
  pistaActual = pista;
  pausadaExplicita = false;

  const destino = volumenObjetivo();
  const pasos = Math.max(1, Math.round(CROSSFADE_MS / FADE_STEP_MS));

  for (let i = 1; i <= pasos; i++) {
    if (miToken !== fadeId) break; // otro cambio de pista/fundido lo reemplazó
    const t = i / pasos;
    try {
      if (viejo) viejo.volume = volViejo * (1 - t);
    } catch {
      /* sin consecuencia */
    }
    try {
      if (nuevo && player === nuevo) nuevo.volume = destino * t;
    } catch {
      /* sin consecuencia */
    }
    await new Promise((r) => setTimeout(r, FADE_STEP_MS));
  }

  if (viejo) {
    try {
      viejo.pause();
      viejo.remove();
    } catch {
      /* sin consecuencia */
    }
  }
}

/** Pausa con fundido, sin soltar el player: Escuchar/Dictado, Modo Oído. */
export async function pausar(): Promise<void> {
  pausadaExplicita = true;
  await fundir(0, DUCK_FADE_MS);
  try {
    player?.pause();
  } catch {
    /* sin consecuencia */
  }
}

/** Retoma tras pausar(), si la música sigue activada. */
export async function reanudar(): Promise<void> {
  pausadaExplicita = false;
  if (!habilitada || !player) return;
  try {
    player.play();
  } catch {
    /* sin consecuencia */
  }
  await fundir(volumenObjetivo(), DUCK_FADE_MS);
}

/** 0 a 1. Aplica en vivo, sin reiniciar la pista. */
export function setVolumen(v: number): void {
  volumenUsuario = Math.max(0, Math.min(1, v));
  if (player && !pausadaExplicita) {
    try {
      player.volume = volumenObjetivo();
    } catch {
      /* sin consecuencia */
    }
  }
}

/**
 * Factor de volumen por pantalla (0 a 1), aparte del volumen del
 * usuario: estudio y gramática lo ponen en ~0.4 mientras tienen el
 * foco. Vuelve a 1 solo, en useMusicaPantalla, al perder el foco.
 */
export function setFactorFoco(f: number, ms = DUCK_FADE_MS): void {
  factorFoco = Math.max(0, Math.min(1, f));
  void fundir(volumenObjetivo(), ms);
}

/**
 * Agacha el volumen mientras suena una voz y lo regresa al terminar o
 * al cancelarse. audio.ts la llama junto a su propio token de
 * reproducción, así que nunca queda agachada de más si la voz se corta.
 */
export async function duck(activo: boolean): Promise<void> {
  agachada = activo;
  await fundir(volumenObjetivo(), DUCK_FADE_MS);
}

/** Prende o apaga la música del todo. Apagarla suelta el player. */
export function setActiva(v: boolean): void {
  habilitada = v;
  if (!v) {
    try {
      player?.pause();
      player?.remove();
    } catch {
      /* sin consecuencia */
    }
    player = null;
    return;
  }
  if (pistaActual) void setPista(pistaActual);
}

/** Suelta el player del todo. Para cerrar sesión: no hace falta seguir cargándolo. */
export function liberar(): void {
  fadeId++;
  try {
    player?.pause();
    player?.remove();
  } catch {
    /* sin consecuencia */
  }
  player = null;
  pistaActual = null;
  iniciada = false;
}

export function isPlaying(): boolean {
  try {
    return Boolean(player?.playing);
  } catch {
    return false;
  }
}

/**
 * Al ir a background se pausa sola con fundido; al volver, se retoma
 * solo si fue este mismo cambio de estado el que la pausó (si el
 * usuario la paró a mano mientras la app no se veía —Escuchar/Dictado—
 * no hay que reactivarla por su cuenta).
 */
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') {
    if (pausadaPorBackground) {
      pausadaPorBackground = false;
      if (!pausadaExplicita && player) {
        try {
          player.play();
        } catch {
          /* sin consecuencia */
        }
        void fundir(volumenObjetivo(), DUCK_FADE_MS);
      }
    }
    return;
  }
  if (isPlaying()) {
    pausadaPorBackground = true;
    void fundir(0, DUCK_FADE_MS).then(() => {
      try {
        player?.pause();
      } catch {
        /* sin consecuencia */
      }
    });
  }
});
