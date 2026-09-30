import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { registrarCorte } from './audio';

/**
 * Reconocimiento de voz.
 *
 * Usa el reconocedor que ya trae el teléfono: Google en Android, Apple
 * en iOS. No hay API de pago, no hay servidor, no hay llave que
 * proteger y el audio no sale del dispositivo.
 *
 * Tres cosas que hay que tener claras antes de tocar este archivo:
 *
 * 1. Devuelve texto, no una calificación de pronunciación. Lo único
 *    que puede juzgar con confianza es cuál de dos palabras se dijo.
 *    Todo lo demás sería inventar un número.
 *
 * 2. Trae código nativo, así que no corre en Expo Go. Necesita un
 *    development build: npx expo run:android. Por eso todo aquí está
 *    envuelto: si el módulo no está, la app sigue funcionando completa
 *    y el laboratorio de habla se muestra apagado con su explicación.
 *
 * 3. El audio nunca se guarda. Lo que se escribe en habla_log es la
 *    transcripción, no el sonido.
 */

export type SpeechState =
  | { ok: true }
  | { ok: false; razon: string; instalable: boolean };

interface RecognitionModule {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  getPermissionsAsync?: () => Promise<{ granted: boolean }>;
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort?: () => void;
  addListener?: (
    event: string,
    handler: (payload: unknown) => void
  ) => { remove: () => void };
}

let mod: RecognitionModule | null = null;
let intentoDeCarga = false;

/** Expo Go se detecta por el entorno, igual que en notifications.ts. */
const enExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Carga perezosa.
 *
 * El try/catch NO basta. El paquete JS sí está instalado en Expo Go, así
 * que el require entra; lo que no existe es el binario nativo, y el
 * error de "Cannot find native module" se reporta a LogBox como no
 * atrapado aunque el catch lo silencie. El usuario ve una pantalla roja
 * por algo que la app ya había manejado.
 *
 * Por eso ni siquiera se intenta el require dentro de Expo Go.
 */
function load(): RecognitionModule | null {
  if (intentoDeCarga) return mod;
  intentoDeCarga = true;

  if (enExpoGo || Platform.OS === 'web') {
    mod = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule?: RecognitionModule;
    };
    mod = pkg.ExpoSpeechRecognitionModule ?? null;
  } catch {
    mod = null;
  }
  return mod;
}

export function isAvailable(): SpeechState {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      razon: 'El laboratorio de habla solo funciona en el teléfono.',
      instalable: false,
    };
  }
  if (enExpoGo) {
    return {
      ok: false,
      razon:
        'El micrófono necesita código nativo, y en Expo Go no está. Se prende solo cuando compiles con npx expo run:android.',
      instalable: true,
    };
  }
  if (!load()) {
    return {
      ok: false,
      razon:
        'Esta parte necesita una compilación con código nativo. En Expo Go no aparece.',
      instalable: true,
    };
  }
  return { ok: true };
}

export async function requestPermission(): Promise<boolean> {
  const m = load();
  if (!m) return false;
  try {
    const res = await m.requestPermissionsAsync();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
}

export interface ListenOptions {
  /**
   * Las dos palabras del par. Se le pasan al reconocedor como pistas de
   * vocabulario: convertir una transcripción libre en una decisión
   * entre dos opciones es lo que sube la precisión de aceptable a útil.
   */
  candidatos: string[];
  /** Cuánto esperar antes de rendirse. */
  timeoutMs?: number;
}

/**
 * Escucha una vez y devuelve lo que entendió, o null si no entendió
 * nada. Nunca lanza: un fallo del reconocedor se trata como silencio,
 * porque el usuario no tiene forma de arreglar una excepción nativa.
 */
export async function listenOnce(
  opts: ListenOptions
): Promise<string | null> {
  const m = load();
  if (!m || !m.addListener) return null;

  const timeout = opts.timeoutMs ?? 5000;

  return new Promise<string | null>((resolve) => {
    let terminado = false;
    const subs: { remove: () => void }[] = [];

    const cerrar = (valor: string | null) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      for (const s of subs) {
        try {
          s.remove();
        } catch {
          /* sin consecuencia */
        }
      }
      try {
        m.stop();
      } catch {
        /* sin consecuencia */
      }
      resolve(valor);
    };

    const reloj = setTimeout(() => cerrar(null), timeout);

    try {
      const onResult = m.addListener?.('result', (payload: unknown) => {
        const texto = extraerTranscripcion(payload);
        if (texto) cerrar(texto);
      });
      if (onResult) subs.push(onResult);

      const onError = m.addListener?.('error', () => cerrar(null));
      if (onError) subs.push(onError);

      const onEnd = m.addListener?.('end', () => cerrar(null));
      if (onEnd) subs.push(onEnd);

      m.start({
        lang: 'en-US',
        interimResults: false,
        maxAlternatives: 3,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        contextualStrings: opts.candidatos,
      });
    } catch {
      cerrar(null);
    }
  });
}

export function cancel(): void {
  const m = load();
  if (!m) return;
  try {
    m.abort?.();
    m.stop();
  } catch {
    /* sin consecuencia */
  }
}

// Se registra una sola vez para que audio.detenerTodo() también corte el
// reconocedor en curso (mic escuchando), no solo lo que suena.
registrarCorte(cancel);

/**
 * El payload del evento cambia de forma entre versiones de la librería
 * y entre plataformas. Se leen las tres formas conocidas en vez de
 * confiar en una: una transcripción perdida se ve como "no te entendí",
 * que es el peor mensaje posible cuando el usuario sí habló.
 */
function extraerTranscripcion(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  const results = p['results'];
  if (Array.isArray(results) && results.length > 0) {
    const first = results[0] as Record<string, unknown> | undefined;
    const t = first?.['transcript'];
    if (typeof t === 'string' && t.length > 0) return t;
  }

  const directo = p['transcript'];
  if (typeof directo === 'string' && directo.length > 0) return directo;

  const value = p['value'];
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0] as string;
  }

  return null;
}
