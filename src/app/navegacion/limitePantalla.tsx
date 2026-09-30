import React, { type ReactNode } from 'react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

/**
 * El `screenLayout` de cada navegador: cada pantalla va en su propio ErrorBoundary. Un error de render en una
 * pantalla ya no tumba la app: esa pantalla muestra «Algo se atoró.» y las demás siguen.
 */
export function limitePorPantalla({ children, route }: { children: ReactNode; route: { name: string } }) {
  return (
    <ErrorBoundary alcance="pantalla" pantalla={route.name}>
      {children}
    </ErrorBoundary>
  );
}
