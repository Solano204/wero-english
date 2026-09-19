/**
 * Anuncios recompensados.
 *
 * Todavía no hay SDK de anuncios en el proyecto, y meter uno falso que
 * "espera tres segundos y paga" sería mentirle al usuario y a las
 * métricas. Así que esto es una interfaz con el proveedor desconectado:
 * mientras no haya proveedor, `isAvailable()` devuelve false y el botón
 * de multiplicar ni siquiera se pinta. Nadie ve un botón que no hace
 * nada.
 *
 * Cuando llegue el momento de conectar AdMob, se implementa un
 * RewardedProvider y se registra en el arranque. Ni una pantalla
 * cambia.
 *
 * Las reglas de colocación del mockup viven aquí como comentario y como
 * forma de la API: solo existe `showRewarded`, que es voluntario y
 * siempre multiplica algo ya ganado. No hay showInterstitial y no lo
 * debe haber en medio de una sesión ni de una partida.
 */

export interface RewardedProvider {
  /** Ya hay un anuncio cargado y listo para mostrarse. */
  isReady: () => boolean;
  /** Muestra el anuncio. Devuelve true solo si se vio completo. */
  show: () => Promise<boolean>;
  /** Pide el siguiente al proveedor. */
  preload: () => void;
}

let provider: RewardedProvider | null = null;

export function registerProvider(p: RewardedProvider | null): void {
  provider = p;
  provider?.preload();
}

export function isAvailable(): boolean {
  return Boolean(provider?.isReady());
}

/**
 * Muestra el anuncio recompensado. Devuelve false si no hubo anuncio o
 * si el usuario lo cerró antes: en los dos casos la recompensa base ya
 * se otorgó y no se le quita nada.
 */
export async function showRewarded(): Promise<boolean> {
  if (!provider?.isReady()) return false;
  try {
    const visto = await provider.show();
    provider.preload();
    return visto;
  } catch {
    return false;
  }
}

/** El multiplicador que paga ver el anuncio, si se vio completo. */
export const MULTIPLICADOR = 5;
