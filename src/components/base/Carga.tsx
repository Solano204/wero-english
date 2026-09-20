import React, { type ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { SkeletonLista } from './Skeleton';
import type { ResultadoCarga } from '@/hooks/useCarga';

interface ErrorProps {
  onReintentar: () => void;
}

export function ErrorCarga({ onReintentar }: ErrorProps) {
  return (
    <EmptyState
      icon="warning"
      title="No se pudo cargar. Intenta de nuevo."
      actionLabel="Reintentar"
      onAction={onReintentar}
    />
  );
}

interface Props<T> {
  carga: ResultadoCarga<T>;
  /** Solo se pinta si la carga pasa de 300 ms; antes no aparece nada. */
  esqueleto?: ReactNode;
  vacio?: ReactNode;
  children: (datos: T) => ReactNode;
}

/** Pinta el estado de una `useCarga`: nada, esqueleto, error, vacío o el contenido. */
export function Carga<T>({ carga, esqueleto, vacio = null, children }: Props<T>) {
  switch (carga.estado) {
    case 'error':
      return <ErrorCarga onReintentar={carga.reintentar} />;
    case 'cargando':
      return carga.demora ? <>{esqueleto ?? <SkeletonLista />}</> : null;
    case 'vacio':
      return <>{vacio}</>;
    case 'listo':
      return <>{children(carga.datos as T)}</>;
  }
}
