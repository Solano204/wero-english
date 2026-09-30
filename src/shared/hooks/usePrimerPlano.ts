import { useSyncExternalStore } from 'react';
import { AppState, type NativeEventSubscription } from 'react-native';

/**
 * ¿La app está en primer plano? Un solo listener de `AppState` para toda la app: antes cada efecto de la señal (15 o
 * más a la vez en Practicar) agregaba el suyo. Se suscribe con el primer componente que lo pide y se quita con el
 * último.
 */
const oyentes = new Set<() => void>();
let sub: NativeEventSubscription | null = null;
let activa = AppState.currentState === 'active';

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  if (!sub) {
    activa = AppState.currentState === 'active';
    sub = AppState.addEventListener('change', (estado) => {
      const ahora = estado === 'active';
      if (ahora === activa) return;
      activa = ahora;
      for (const o of oyentes) o();
    });
  }
  return () => {
    oyentes.delete(avisar);
    if (oyentes.size === 0 && sub) {
      sub.remove();
      sub = null;
    }
  };
}

const leer = () => activa;

export function usePrimerPlano(): boolean {
  return useSyncExternalStore(suscribir, leer, leer);
}
