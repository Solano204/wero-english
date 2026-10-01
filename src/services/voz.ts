import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { detenerTodo, registrarCorte } from './audio';
import { extraerAlternativas, ordenarPorConfianza } from '@/domain/voz';
import type { AlternativaVoz } from '@/types';

/**
 * Reconocimiento de voz.
 *
 * Usa el reconocedor que ya trae el teléfono (en Android, el de Google). No hay API de pago ni servidor de Wero.
 *
 * DÓNDE SE PROCESA LA VOZ: primero se intenta en el teléfono. En Android 13 o más nuevo, si el teléfono tiene el
 * reconocimiento sin conexión y el paquete de inglés (en-US) ya instalado, se usa ese (`requiresOnDeviceRecognition`,
 * que en expo-speech-recognition crea el reconocedor del dispositivo) y el audio no sale del teléfono. Si no, se usa
 * el reconocedor normal del sistema, que puede mandar el audio a los servidores de Google para entenderlo. Wero no
 * graba ni guarda el audio en ninguno de los dos casos: solo recibe el texto.
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
 * 3. El audio nunca se guarda (no se pide `recordingOptions.persist`). Lo que se escribe en habla_log es la
 *    transcripción, no el sonido.
 */

export type SpeechState =
  | { ok: true }
  | { ok: false; razon: string; instalable: boolean };

interface RecognitionModule {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  getPermissionsAsync?: () => Promise<{ granted: boolean }>;
  supportsOnDeviceRecognition?: () => boolean;
  getSupportedLocales?: (o: { androidRecognitionServicePackage?: string }) => Promise<{
    locales: string[];
    installedLocales: string[];
  }>;
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

import type { EstadoEscucha, ListenOptions, ResultadoEscucha } from './voz/tipos';

export type { EstadoEscucha, ListenOptions, ResultadoEscucha };

/** Tras cortar el audio de la app, cuánto esperar antes de abrir el micrófono (que no se cuele la cola del sonido). */
const ESPERA_TRAS_CORTE_MS = 250;
/** Si llega `end` sin resultado, cuánto esperar por un `result` tardío antes de cerrar. */
const MARGEN_TRAS_END_MS = 400;
/** Al llegar al tope se pide el resultado (`stop`); cuánto esperarlo. */
const MARGEN_TRAS_STOP_MS = 700;
/** Tope de escucha desde `start`. */
const TOPE_MS = 8000;
/** Si el reconocedor nunca avisa que ya escucha, se deja de esperar. */
const TOPE_ARRANQUE_MS = 4000;
/** Cada cuánto manda el volumen el reconocedor. */
const INTERVALO_VOLUMEN_MS = 80;
/** Alternativas que se piden. */
const ALTERNATIVAS = 5;

/**
 * Silencios del reconocedor de Android (RecognizerIntent). Por omisión corta muy rápido una palabra de una sílaba o
 * si tardas un instante en empezar. Con esto: no termina antes de 2 s (da tiempo a tomar aire y decir «ship»), y tras
 * dejar de oír voz espera 1.2–1.5 s antes de dar por terminado. La documentación de Android advierte que, según el
 * reconocedor, «estos valores pueden no tener efecto»: el de Google en algunas versiones los ignora. Por eso además
 * hay margen tras `end` y respaldo con el último parcial.
 */
const SILENCIOS_ANDROID = {
  EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 2000,
  EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
  EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1200,
};

/** Errores con los que el reconocedor del teléfono dice «así no puedo»: se vuelve a intentar con el del sistema. */
const ERRORES_SIN_DISPOSITIVO = new Set(['language-not-supported', 'service-not-allowed', 'not-allowed']);

let dispositivo: Promise<boolean> | null = null;

/**
 * ¿Se puede reconocer inglés en el teléfono, sin mandar el audio? Android 13+, reconocimiento en el dispositivo
 * disponible y el paquete en-US ya instalado. Se decide una vez por sesión de la app.
 */
export function reconoceEnDispositivo(): Promise<boolean> {
  if (!dispositivo) {
    dispositivo = (async () => {
      const m = load();
      if (!m || Platform.OS !== 'android' || Number(Platform.Version) < 33) return false;
      try {
        if (!m.supportsOnDeviceRecognition?.()) return false;
        // Con tope: si el servicio de voz no contesta, se usa el reconocedor del sistema en vez de esperar sin fin.
        const r = await Promise.race([
          m.getSupportedLocales?.({}),
          espera(TOPE_IDIOMAS_MS).then(() => undefined),
        ]);
        return (r?.installedLocales ?? []).some((l) => l.replace('_', '-').toLowerCase() === 'en-us');
      } catch {
        return false;
      }
    })();
  }
  return dispositivo;
}

/**
 * Pide descargar el paquete de inglés para reconocer sin conexión (Android 13+). En Android 13 abre el diálogo del
 * sistema; en 14+ lo baja o lo agenda (p. ej. esperando wifi). Nunca lanza.
 */
export async function descargarInglesSinConexion(): Promise<string> {
  const m = load() as (RecognitionModule & {
    androidTriggerOfflineModelDownload?: (o: { locale: string }) => Promise<{ status: string }>;
  }) | null;
  if (!m?.androidTriggerOfflineModelDownload) return 'no_disponible';
  try {
    const r = await m.androidTriggerOfflineModelDownload({ locale: 'en-US' });
    dispositivo = null;
    return r.status;
  } catch {
    return 'error';
  }
}

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Lo más que se espera a que el teléfono diga qué idiomas reconoce sin conexión. */
const TOPE_IDIOMAS_MS = 3000;

/**
 * Escucha una vez y devuelve TODO lo que entendió (las alternativas), o nada si no entendió. Nunca lanza: un fallo
 * del reconocedor se trata como «no entendí», porque quien habla no tiene forma de arreglar una excepción nativa.
 *
 * Antes de abrir el micrófono se corta el audio de la app y se espera un instante, para que no se grabe la cola de
 * un sonido. Si el final nunca llega se usa el último parcial; si `end` llega antes que `result`, se espera un margen.
 */
export async function listenOnce(opts: ListenOptions): Promise<ResultadoEscucha> {
  const m = load();
  const vacio = (error: string | null, enDispositivo = false): ResultadoEscucha => ({
    alternativas: [],
    origen: 'nada',
    parciales: [],
    enDispositivo,
    error,
    volumenMax: -2,
  });
  if (!m || !m.addListener) return vacio('no_disponible');

  opts.onEstado?.('preparando');
  detenerTodo();
  // Después del corte (que también llama a `cancel`): si alguien cancela durante las esperas de abajo (la pantalla se
  // fue), el micrófono no se abre.
  const mia = generacionEscucha;
  const cancelada = () => mia !== generacionEscucha;
  await espera(ESPERA_TRAS_CORTE_MS);
  if (cancelada()) return vacio('cancelada');

  const enDispositivo = await reconoceEnDispositivo();
  if (cancelada()) return vacio('cancelada');
  const primero = await escucharCon(m, opts, enDispositivo);
  // El reconocedor del teléfono dijo que no puede (paquete borrado, servicio apagado): se intenta con el del sistema.
  if (enDispositivo && primero.error && ERRORES_SIN_DISPOSITIVO.has(primero.error) && primero.origen === 'nada') {
    dispositivo = Promise.resolve(false);
    if (cancelada()) return vacio('cancelada');
    return escucharCon(m, opts, false);
  }
  return primero;
}

function escucharCon(m: RecognitionModule, opts: ListenOptions, enDispositivo: boolean): Promise<ResultadoEscucha> {
  const tope = opts.topeMs ?? TOPE_MS;

  return new Promise<ResultadoEscucha>((resolve) => {
    let terminado = false;
    let final: AlternativaVoz[] | null = null;
    let parcial: AlternativaVoz[] = [];
    const parciales: string[] = [];
    let error: string | null = null;
    let volumenMax = -2;
    const relojes: ReturnType<typeof setTimeout>[] = [];
    const subs: { remove: () => void }[] = [];
    const escuchar = (evento: string, fn: (payload: unknown) => void) => {
      const s = m.addListener?.(evento, fn);
      if (s) subs.push(s);
    };
    const programar = (fn: () => void, ms: number) => relojes.push(setTimeout(fn, ms));

    const cerrar = () => {
      if (terminado) return;
      terminado = true;
      for (const r of relojes) clearTimeout(r);
      for (const s of subs) {
        try {
          s.remove();
        } catch {
          /* sin consecuencia */
        }
      }
      try {
        m.abort?.();
      } catch {
        /* sin consecuencia */
      }
      const alternativas = final && final.length > 0 ? final : parcial;
      resolve({
        alternativas: ordenarPorConfianza(alternativas),
        origen: final && final.length > 0 ? 'final' : parcial.length > 0 ? 'parcial' : 'nada',
        parciales,
        enDispositivo,
        error,
        volumenMax,
      });
    };

    // Se acabó el tiempo: se le pide al reconocedor su resultado y se le da un margen para mandarlo.
    const alTope = () => {
      if (terminado) return;
      opts.onEstado?.('procesando');
      try {
        m.stop();
      } catch {
        /* sin consecuencia */
      }
      programar(cerrar, MARGEN_TRAS_STOP_MS);
    };

    let arranco = false;
    programar(() => {
      if (!arranco) cerrar();
    }, TOPE_ARRANQUE_MS);

    try {
      escuchar('start', () => {
        if (arranco) return;
        arranco = true;
        opts.onEstado?.('escuchando');
        programar(alTope, tope);
      });
      escuchar('speechend', () => opts.onEstado?.('procesando'));
      escuchar('volumechange', (payload) => {
        const v = (payload as { value?: unknown } | null)?.value;
        if (typeof v !== 'number') return;
        if (v > volumenMax) volumenMax = v;
        opts.onVolumen?.(v);
      });
      escuchar('result', (payload) => {
        const alternativas = extraerAlternativas(payload);
        if (alternativas.length === 0) return;
        if ((payload as { isFinal?: unknown } | null)?.isFinal === false) {
          parcial = alternativas;
          parciales.push(alternativas[0]!.texto);
          opts.onParcial?.(alternativas[0]!.texto);
          return;
        }
        final = alternativas;
        cerrar();
      });
      escuchar('error', (payload) => {
        const codigo = (payload as { error?: unknown } | null)?.error;
        error = typeof codigo === 'string' ? codigo : 'desconocido';
        // Tras un error el reconocedor manda `end`; por si no, se cierra con margen (un `result` tardío aún cuenta).
        programar(cerrar, MARGEN_TRAS_END_MS);
      });
      // `end` puede llegar antes que un `result` tardío: se espera un poco antes de cerrar con lo que haya.
      escuchar('end', () => programar(cerrar, MARGEN_TRAS_END_MS));

      m.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: ALTERNATIVAS,
        continuous: false,
        requiresOnDeviceRecognition: enDispositivo,
        addsPunctuation: false,
        contextualStrings: opts.candidatos,
        volumeChangeEventOptions: { enabled: true, intervalMillis: INTERVALO_VOLUMEN_MS },
        ...(Platform.OS === 'android' ? { androidIntentOptions: SILENCIOS_ANDROID } : null),
      });
    } catch {
      error = 'no_arranco';
      cerrar();
    }
  });
}

/** Sube con cada `cancel()`: una escucha que todavía no abrió el micrófono ve que cambió y ya no lo abre. */
let generacionEscucha = 0;

export function cancel(): void {
  generacionEscucha++;
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
