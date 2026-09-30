import React, { type ReactNode } from 'react';
import Animated from 'react-native-reanimated';
import { EmptyState } from './EmptyState';
import { SkeletonLista } from './Skeleton';
import type { ResultadoCarga } from '@/hooks/useCarga';
import { aparecer, desaparecer } from '@/theme';

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

/**
 * Pinta el estado de una `useCarga`: nada, esqueleto, error, vacío o el
 * contenido. El esqueleto se desvanece y lo que sigue entra con el mismo
 * fade cruzado de `base` (220 ms), sin importar cuál sea.
 */
export function Carga<T>({ carga, esqueleto, vacio = null, children }: Props<T>) {
  switch (carga.estado) {
    case 'error':
      return <ErrorCarga onReintentar={carga.reintentar} />;
    case 'cargando':
      return carga.demora ? (
        <Animated.View exiting={desaparecer()}>{esqueleto ?? <SkeletonLista />}</Animated.View>
      ) : null;
    case 'vacio':
      return <Animated.View entering={aparecer()}>{vacio}</Animated.View>;
    case 'listo':
      return <Animated.View entering={aparecer()}>{children(carga.datos as T)}</Animated.View>;
  }
}
