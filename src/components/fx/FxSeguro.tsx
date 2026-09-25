import React, { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Lo que se pinta si el efecto falla. Sin nada, el efecto simplemente no aparece. */
  fallback?: ReactNode;
}

interface Estado {
  fallo: boolean;
}

/**
 * Si un efecto de Skia o de un sensor falla, la pantalla se ve completa y
 * estática: el error no sube hasta el `ErrorBoundary` de la app.
 */
export class FxSeguro extends React.Component<Props, Estado> {
  override state: Estado = { fallo: false };

  static getDerivedStateFromError(): Estado {
    return { fallo: true };
  }

  override componentDidCatch(error: Error): void {
    if (__DEV__) console.warn(`[fx] efecto apagado: ${error.message}`);
  }

  override render(): ReactNode {
    return this.state.fallo ? (this.props.fallback ?? null) : this.props.children;
  }
}
