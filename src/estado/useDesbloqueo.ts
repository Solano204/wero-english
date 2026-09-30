import { useAuthStore } from './useAuthStore';
import { useUnlockStore } from './useUnlockStore';
import type { TipoDesbloqueo } from '@/types';

export interface Desbloqueo {
  /** Ya está abierto para siempre. */
  abierto: boolean;
  /** Hay usuario con quien guardarlo: sin él, el botón no hace nada. */
  puede: boolean;
  desbloquear: () => Promise<void>;
}

/** Lo que el muro de desbloqueo (shared/ui/MuroDesbloqueo) necesita del estado: si está abierto y cómo abrirlo. */
export function useDesbloqueo(tipo: TipoDesbloqueo, id: string): Desbloqueo {
  const user = useAuthStore((s) => s.user);
  const abierto = useUnlockStore((s) => s.abierto(tipo, id));
  const abrir = useUnlockStore((s) => s.abrir);
  const desbloquear = async () => {
    if (!user) return;
    await abrir(user.id, tipo, id);
  };
  return { abierto, puede: user != null, desbloquear };
}
