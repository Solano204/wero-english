import { create } from 'zustand';
import { claveDe, desbloquear, getDesbloqueos, type TipoDesbloqueo } from '@/data/repos/desbloqueos';
import * as ads from '@/services/ads';
import { ANUNCIOS_ACTIVOS } from '@/config/monetizacion';

/**
 * Qué está desbloqueado.
 *
 * Se carga entero de golpe al entrar y se mantiene en memoria. Son unas
 * pocas decenas de claves como mucho: consultar la base cada vez que se
 * pinta una tarjeta de la lista sería un viaje a SQLite por fila.
 *
 * `abrir` es optimista a propósito. El usuario ya vio el anuncio; si la
 * escritura en disco falla, lo último que debe pasar es que se quede
 * mirando el muro otra vez. Se abre en memoria y se persiste después.
 */

interface UnlockState {
  cargado: boolean;
  claves: Set<string>;
  cargar: (usuarioId: number) => Promise<void>;
  /** ¿Está abierto? Sin usuario todavía, se asume cerrado. */
  abierto: (tipo: TipoDesbloqueo, id: string) => boolean;
  /**
   * Muestra el anuncio recompensado y abre la clave.
   *
   * Devuelve true si quedó abierta. Si no hay proveedor de anuncios
   * configurado, abre igual: un muro que no se puede quitar porque el
   * SDK no está conectado es una pantalla rota, no un modelo de negocio.
   */
  abrir: (usuarioId: number, tipo: TipoDesbloqueo, id: string) => Promise<boolean>;
}

export const useUnlockStore = create<UnlockState>((set, get) => ({
  cargado: false,
  claves: new Set(),

  cargar: async (usuarioId) => {
    const claves = await getDesbloqueos(usuarioId);
    set({ claves, cargado: true });
  },

  // Interruptor de monetización: sin anuncios, todo lo que se cerraba por
  // anuncio queda abierto, sin escribir en la base (así no hay nada que
  // migrar cuando el interruptor vuelva a `true`).
  abierto: (tipo, id) => !ANUNCIOS_ACTIVOS || get().claves.has(claveDe(tipo, id)),

  abrir: async (usuarioId, tipo, id) => {
    const clave = claveDe(tipo, id);
    if (get().claves.has(clave)) return true;

    // Si hay anuncio cargado se muestra. Si no lo hay, se sigue de largo:
    // el contenido no se rehén de que el SDK esté disponible.
    if (ads.isAvailable()) {
      await ads.showRewarded();
    }

    set((s) => {
      const claves = new Set(s.claves);
      claves.add(clave);
      return { claves };
    });

    try {
      await desbloquear(usuarioId, clave);
    } catch {
      // Ya está abierto en memoria y el usuario ya pagó con su atención.
      // Se reintenta solo la próxima vez que abra la app.
    }
    return true;
  },
}));
