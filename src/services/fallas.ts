import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { anotarFalla, leerFallas, type Falla } from '@/data/local/registroFallas';

/**
 * Qué pasó cuando algo falló: se anota en el teléfono (los últimos 50, ver data/local/registroFallas.ts) para que un
 * tester copie el reporte desde Ajustes → Acerca de y lo mande a mano. Nada sale del teléfono solo.
 *
 * Si algún día se usa Sentry u otro servicio, primero se actualizan el aviso de privacidad y la sección de Seguridad de
 * los datos de Play (docs/PRIVACIDAD.md, docs/PLAY_SEGURIDAD_DATOS.md).
 */

let pantallaActual: string | null = null;

/** La navegación avisa la ruta visible (App.tsx), para anotarla con cada falla. */
export function setPantallaActual(nombre: string | null | undefined): void {
  pantallaActual = nombre ?? null;
}

function comoError(e: unknown): { mensaje: string; pila: string | null } {
  if (e instanceof Error) return { mensaje: `${e.name}: ${e.message}`, pila: e.stack ?? null };
  try {
    return { mensaje: typeof e === 'string' ? e : JSON.stringify(e), pila: null };
  } catch {
    return { mensaje: String(e), pila: null };
  }
}

/** Anota un error. `origen` dice quién lo atrapó (p. ej. 'juego:colmena'). Nunca lanza. */
export function registrarFalla(e: unknown, origen: string, pantalla: string | null = pantallaActual): Promise<void> {
  const { mensaje, pila } = comoError(e);
  if (__DEV__) console.warn(`[falla] ${origen}`, mensaje);
  return anotarFalla({ fecha: new Date().toISOString(), pantalla, origen, mensaje, pila });
}

/**
 * Para las promesas que no se esperan (`void …`): si fallan, se anotan en vez de quedar como rechazo sin atrapar. No
 * cambia lo que pasa en la pantalla.
 */
export function sinEsperar(promesa: Promise<unknown>, origen: string): void {
  promesa.catch((e: unknown) => registrarFalla(e, origen));
}

/** El reporte en texto plano, listo para pegar en un mensaje. */
export async function reporteDeFallas(): Promise<string> {
  const fallas = await leerFallas();
  const version = Constants.expoConfig?.version ?? '?';
  const cabeza = `Wero ${version} · ${Platform.OS} ${String(Platform.Version)} · ${fallas.length} errores guardados`;
  if (fallas.length === 0) return `${cabeza}\n\nSin errores anotados.`;
  const cuerpo = [...fallas]
    .reverse()
    .map((f: Falla) => [`${f.fecha} · ${f.pantalla ?? 'sin pantalla'} · ${f.origen}`, f.mensaje, f.pila ?? ''].join('\n').trim())
    .join('\n\n---\n\n');
  return `${cabeza}\n\n${cuerpo}`;
}

/** Copia el reporte al portapapeles para pegarlo en un mensaje (Ajustes → Acerca de). Devuelve si se pudo. */
export async function copiarReporteDeFallas(): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(await reporteDeFallas());
    return true;
  } catch (e) {
    void registrarFalla(e, 'ajustes:copiar-reporte');
    return false;
  }
}

/** Espera a lo más `ms` a que se guarde (antes de que un error fatal cierre la app). */
function conPlazo(p: Promise<void>, ms: number): Promise<void> {
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
}

let instalado = false;

/**
 * Manejadores globales: errores de JS sin atrapar (se anotan y luego sigue el manejador de siempre, que en release
 * cierra la app si es fatal) y promesas rechazadas sin `catch` (solo se anotan). Una sola vez, al cargar la app.
 */
export function instalarManejadoresDeFallas(): void {
  if (instalado) return;
  instalado = true;

  const global = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (e: unknown, fatal?: boolean) => void;
      setGlobalHandler: (fn: (e: unknown, fatal?: boolean) => void) => void;
    };
    HermesInternal?: {
      enablePromiseRejectionTracker?: (o: {
        allRejections: boolean;
        onUnhandled: (id: number, e: unknown) => void;
        onHandled?: (id: number) => void;
      }) => void;
    };
  };

  const eu = global.ErrorUtils;
  if (eu) {
    const anterior = eu.getGlobalHandler();
    eu.setGlobalHandler((e, fatal) => {
      void conPlazo(registrarFalla(e, fatal ? 'global:fatal' : 'global'), 500).then(() => anterior(e, fatal));
    });
  }

  // En desarrollo React Native ya avisa estos rechazos en pantalla; en release no hay nadie que los vea.
  if (!__DEV__) {
    global.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, e) => void registrarFalla(e, 'promesa'),
      onHandled: () => undefined,
    });
  }
}
