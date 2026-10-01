import { Directory, File, Paths } from 'expo-file-system';
import { estaDescargado, marcarDescargado, marcarNoDescargado } from '@/data/repos/packs';
import * as media from './media';
import type { Pack } from '@/types';

/**
 * Descarga de packs de medios desde R2.
 *
 * Diseño clave: se descarga archivo por archivo con el manifest como
 * guía, no un zip. Un zip de 8 MB que se corta al 90% se pierde entero;
 * archivo por archivo se reanuda donde iba comparando tamaños.
 */

interface ManifestFile {
  ruta: string;
  bytes: number;
  sha256: string;
}

interface Manifest {
  pack_id: string;
  version: number;
  generado: string;
  archivos: ManifestFile[];
  total_bytes: number;
}

export interface DownloadProgress {
  packId: string;
  done: number;
  total: number;
  bytes: number;
  totalBytes: number;
}

export type DownloadState =
  | { kind: 'idle' }
  | { kind: 'running'; progress: DownloadProgress }
  | { kind: 'done'; bytes: number }
  | { kind: 'error'; message: string };

const running = new Set<string>();

export function ensureMediaDir(): void {
  if (!media.MEDIA_DIR.exists) {
    media.MEDIA_DIR.create({ intermediates: true });
  }
}

export async function isDownloaded(
  usuarioId: number,
  packId: string
): Promise<boolean> {
  return estaDescargado(usuarioId, packId);
}

/**
 * Descarga los medios de un pack.
 * Salta los archivos que ya existen con el tamaño correcto, así que
 * volver a llamar después de un corte reanuda en vez de reempezar.
 */
export async function downloadPack(
  usuarioId: number,
  pack: Pack,
  onProgress: (p: DownloadProgress) => void,
  shouldContinue: () => boolean
): Promise<DownloadState> {
  if (!pack.url) {
    return { kind: 'error', message: 'Este pack ya viene en la app.' };
  }
  if (running.has(pack.id)) {
    return { kind: 'error', message: 'Ya se está descargando.' };
  }

  running.add(pack.id);
  try {
    ensureMediaDir();

    const manifest = await fetchManifest(pack.url);
    if (!manifest) {
      return { kind: 'error', message: 'No se pudo leer la lista de archivos del pack. Revisa tu conexión y vuelve a intentar.' };
    }

    let done = 0;
    let bytes = 0;

    for (const item of manifest.archivos) {
      if (!shouldContinue()) {
        return { kind: 'error', message: 'Descarga cancelada.' };
      }

      const dest = media.fileFor(item.ruta);

      if (dest.exists && dest.size === item.bytes) {
        done++;
        bytes += item.bytes;
        onProgress(makeProgress(pack.id, done, manifest, bytes));
        continue;
      }

      ensureParent(dest);

      try {
        if (dest.exists) dest.delete();
        await File.downloadFileAsync(`${pack.url}${item.ruta}`, dest);
      } catch {
        return { kind: 'error', message: `No se pudo bajar ${item.ruta}. Revisa tu conexión y vuelve a intentar.` };
      }

      done++;
      bytes += item.bytes;
      onProgress(makeProgress(pack.id, done, manifest, bytes));
    }

    media.invalidate();
    await markDownloaded(usuarioId, pack.id, bytes, manifest.version);
    return { kind: 'done', bytes };
  } catch {
    return { kind: 'error', message: 'No se pudo descargar el pack. Revisa tu conexión y vuelve a intentar.' };
  } finally {
    running.delete(pack.id);
  }
}

export async function deletePackMedia(
  usuarioId: number,
  packId: string
): Promise<void> {
  try {
    const dir = new Directory(media.MEDIA_DIR, packId);
    if (dir.exists) dir.delete();
  } catch {
    // Si no existe, no hay nada que borrar.
  }
  media.invalidate();

  await marcarNoDescargado(usuarioId, packId);
}

/** Cuánto ocupan los medios en el teléfono, en bytes. */
export function mediaSize(): number {
  try {
    if (!media.MEDIA_DIR.exists) return 0;
    return sizeOf(media.MEDIA_DIR);
  } catch {
    return 0;
  }
}

function sizeOf(dir: Directory): number {
  let total = 0;
  for (const item of dir.list()) {
    if (item instanceof File) total += item.size ?? 0;
    else total += sizeOf(item);
  }
  return total;
}

function makeProgress(
  packId: string,
  done: number,
  manifest: Manifest,
  bytes: number
): DownloadProgress {
  return {
    packId,
    done,
    total: manifest.archivos.length,
    bytes,
    totalBytes: manifest.total_bytes,
  };
}

async function fetchManifest(baseUrl: string): Promise<Manifest | null> {
  try {
    const res = await fetch(`${baseUrl}manifest.json`);
    if (!res.ok) return null;
    return (await res.json()) as Manifest;
  } catch {
    return null;
  }
}

function ensureParent(file: File): void {
  const parent = new Directory(Paths.dirname(file.uri));
  if (!parent.exists) parent.create({ intermediates: true });
}

async function markDownloaded(
  usuarioId: number,
  packId: string,
  bytes: number,
  version: number
): Promise<void> {
  await marcarDescargado(usuarioId, packId, bytes, version);
}
