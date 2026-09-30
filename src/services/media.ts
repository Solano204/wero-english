import { Directory, File, Paths } from 'expo-file-system';
import { Asset } from 'expo-asset';
import type { ImageSourcePropType } from 'react-native';
import { bundledModule, isBundled } from '@/assets/bundled';
import { Lru } from '@/domain/lru';

// Lo empaquetado se pregunta aquí: features y shared no importan el mapa generado directo.
export { BUNDLED_COUNT, isBundled } from '@/assets/bundled';

/**
 * Resuelve una ruta relativa del JSON ("aud/18.mp3", "img/err/err_001.webp")
 * a algo que el teléfono pueda abrir.
 *
 * El orden importa:
 *   1. Empaquetado en el APK  → instantáneo, siempre disponible
 *   2. Descargado a disco     → el resto de los packs
 *   3. No existe              → null, y la UI se degrada sin romperse
 *
 * Sin el paso 1 los medios del pack gratis nunca se encontrarían: Metro
 * no puede hacer require() con una ruta variable, así que hace falta el
 * mapa generado en assets/bundled.ts.
 */

/** La carpeta donde viven los packs descargados. */
export const MEDIA_DIR = new Directory(Paths.document, 'media');

type Resolved =
  | { kind: 'bundled'; module: number; uri: string }
  | { kind: 'file'; uri: string }
  | null;

/**
 * Tope de las dos cachés de rutas de abajo: más que las rutas que una sesión larga toca (una pantalla usa decenas), menos
 * que todo el catálogo (~8k medios), para que no crezcan sin fin.
 */
const TOPE_CACHE_RUTAS = 1500;

/** Caché de resolución. Evita un stat al disco por cada toque. */
const cache = new Lru<string, Resolved>(TOPE_CACHE_RUTAS);

export function fileFor(relPath: string): File {
  return new File(MEDIA_DIR, relPath);
}

export async function resolve(relPath: string | null): Promise<Resolved> {
  if (!relPath) return null;

  const hit = cache.get(relPath);
  if (hit !== undefined) return hit;

  const mod = bundledModule(relPath);
  if (mod !== null) {
    // Nada de downloadAsync aquí: el reproductor recibe el módulo de
    // require() tal cual (ver audio.ts), así que bajar el asset a caché
    // solo para obtener una uri que nadie usa era un viaje a red inútil
    // (y en Expo Go, un fallo silencioso si el packager no respondía).
    const out: Resolved = {
      kind: 'bundled',
      module: mod,
      uri: Asset.fromModule(mod).uri,
    };
    cache.set(relPath, out);
    return out;
  }

  try {
    const f = fileFor(relPath);
    if (f.exists) {
      const out: Resolved = { kind: 'file', uri: f.uri };
      cache.set(relPath, out);
      return out;
    }
  } catch {
    // Un fallo de FS no debe tumbar la pantalla: se sigue sin el medio.
  }

  cache.set(relPath, null);
  return null;
}

/** La URI lista para reproducir, o null si el archivo no está. */
export async function uriFor(relPath: string | null): Promise<string | null> {
  const r = await resolve(relPath);
  return r?.uri ?? null;
}

/**
 * Caché de `expo-image` para los medios de la app. Son archivos locales (del APK o descargados): en Android la política
 * por defecto (`disk`) se salta la caché de memoria y vuelve a decodificar la imagen cada vez que se monta, y además
 * escribe una copia en la caché de disco. Con `memory` la imagen decodificada se reutiliza al volver a una pantalla o
 * al reciclar una fila, y no se duplica en disco.
 */
export const CACHE_IMAGEN = 'memory' as const;

/**
 * Fuente para <Image>. Es síncrona a propósito: un componente de imagen
 * no puede esperar a una promesa sin parpadear.
 *
 * Para lo empaquetado devuelve el módulo directo, que es lo más rápido.
 * Para lo descargado devuelve la URI de archivo, que existe o no; si no
 * existe, Image simplemente no pinta nada y el layout no se rompe.
 */
export function imageSource(relPath: string | null): ImageSourcePropType | null {
  if (!relPath) return null;
  const mod = bundledModule(relPath);
  if (mod !== null) return mod;
  try {
    return { uri: fileFor(relPath).uri };
  } catch {
    return null;
  }
}

/** Caché de «¿existe este archivo?»: `File.exists` es síncrono y las imágenes lo preguntaban en cada render. */
const existe = new Lru<string, boolean>(TOPE_CACHE_RUTAS);

/** ¿Hay archivo en esta ruta (empaquetado o ya descargado)? Se pregunta al disco una vez por ruta. */
export function hayArchivo(relPath: string | null): boolean {
  if (!relPath) return false;
  const hit = existe.get(relPath);
  if (hit !== undefined) return hit;
  let out = false;
  if (isBundled(relPath)) out = true;
  else {
    try {
      out = fileFor(relPath).exists;
    } catch {
      out = false;
    }
  }
  existe.set(relPath, out);
  return out;
}

/** Limpia la caché. Se llama tras descargar o borrar un pack. */
export function invalidate(): void {
  cache.clear();
  existe.clear();
}

export function invalidateOne(relPath: string): void {
  cache.delete(relPath);
  existe.delete(relPath);
}
