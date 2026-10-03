import { useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { pedirRecompensa, razonMuro } from '@/shared/ui';
import { useAuthStore } from '@/estado/useAuthStore';
import { loadContent } from '@/data/contenido';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';
import * as downloads from '@/services/descargas';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Todos los packs vienen dentro del APK: no queda nada por descargar. */
export function todoIncluido(): boolean {
  return loadContent().packs.packs.every((p) => p.empaquetado);
}

/**
 * Descargas: los paquetes de medios y su estado.
 */
export function useDescargas() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const content = loadContent();

  const [progress, setProgress] = useState<
    Record<string, downloads.DownloadProgress>
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cancel = useRef<Record<string, boolean>>({});
  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();

  const descargar = async (packId: string) => {
    if (!user) return;
    const pack = content.packs.packs.find((p) => p.id === packId);
    if (!pack) return;

    /*
     * Antes de bajar el pack va un anuncio.
     *
     * Este es el único muro de la app y va aquí a propósito: es el
     * momento en que el usuario ya decidió que quiere ese contenido,
     * así que ver el video es un trato, no un peaje sorpresa.
     *
     * Si no hay proveedor conectado, `pedirRecompensa` devuelve
     * 'sin_anuncio' y la descarga procede. Bloquear contenido por un
     * anuncio que no existe es peor que no monetizar.
     *
     * Si el usuario cierra el video antes de tiempo, se cancela la
     * descarga sin regaño y puede volver a intentar.
     */
    setErrors((e) => ({ ...e, [packId]: '' }));
    // La primera vez, la hoja que dice qué ve el servidor de archivos. «Ahora no» no descarga.
    if (!(await pedirConsentimiento('descargas'))) return;
    const trato = await pedirRecompensa();
    if (trato !== 'visto') {
      // Sin anuncio no hay pack. Es el único muro de la app y es
      // duro a propósito: si se concediera igual, el anuncio dejaría
      // de ser un trato y sería un botón que a veces sale.
      setErrors((e) => ({ ...e, [packId]: razonMuro(trato) }));
      return;
    }

    cancel.current[packId] = false;

    const res = await downloads.downloadPack(
      user.id,
      pack,
      (p) => setProgress((s) => ({ ...s, [packId]: p })),
      () => !cancel.current[packId]
    );

    if (res.kind === 'error') {
      setErrors((e) => ({ ...e, [packId]: res.message }));
    }
    setProgress((s) => {
      const next = { ...s };
      delete next[packId];
      return next;
    });
  };

  const packs = [...content.packs.packs].sort(
    (a, b) => a.orden - b.orden || a.mundo.localeCompare(b.mundo)
  );

  // «Cancelar» de un pack: la descarga en curso lo lee entre archivo y archivo.
  const cancelar = (packId: string) => {
    cancel.current[packId] = true;
  };

  return { nav, progress, errors, cancelar, hoja, descargar, packs };
}
