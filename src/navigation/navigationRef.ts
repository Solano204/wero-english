import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParams } from './routes';

/**
 * Referencia global de navegación.
 * La necesitan las notificaciones, que llegan fuera del árbol de React.
 */
export const navigationRef = createNavigationContainerRef<RootStackParams>();

export function navigate<T extends keyof RootStackParams>(
  name: T,
  params?: RootStackParams[T]
): void {
  if (!navigationRef.isReady()) return;
  // navigate está sobrecargado y TypeScript no puede estrechar el tipo
  // con un genérico abierto, así que hay que pasar por unknown.
  const go = navigationRef.navigate as unknown as (
    n: string,
    p?: object
  ) => void;
  go(name, params as object | undefined);
}
