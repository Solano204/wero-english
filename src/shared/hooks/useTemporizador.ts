import { useEffect, useEffectEvent, useState } from 'react';

type Pendiente = { tipo: 'tiempo'; id: ReturnType<typeof setTimeout> } | { tipo: 'cuadro'; id: number };

export interface Temporizador {
  /** `setTimeout` que se cancela solo si el componente se desmonta antes. */
  despues: (fn: () => void, ms: number) => void;
  /** `requestAnimationFrame` que se cancela solo si el componente se desmonta antes. */
  cuadro: (fn: () => void) => void;
  /** Cancela todo lo pendiente (p. ej. al perder el foco o al empezar otra ronda). */
  limpiar: () => void;
}

function crearTemporizador(): Temporizador {
  const pendientes = new Set<Pendiente>();
  const limpiar = () => {
    for (const p of pendientes) {
      if (p.tipo === 'tiempo') clearTimeout(p.id);
      else cancelAnimationFrame(p.id);
    }
    pendientes.clear();
  };
  return {
    despues(fn, ms) {
      const p: Pendiente = {
        tipo: 'tiempo',
        id: setTimeout(() => {
          pendientes.delete(p);
          fn();
        }, ms),
      };
      pendientes.add(p);
    },
    cuadro(fn) {
      const p: Pendiente = {
        tipo: 'cuadro',
        id: requestAnimationFrame(() => {
          pendientes.delete(p);
          fn();
        }),
      };
      pendientes.add(p);
    },
    limpiar,
  };
}

/**
 * Temporizadores de un componente que se limpian solos al desmontarse: nada dispara un `setState` ni una navegación
 * después de que la pantalla se fue. El objeto es estable (se puede usar en efectos sin ponerlo en las dependencias
 * de nada que cambie).
 */
export function useTemporizador(): Temporizador {
  const [t] = useState(crearTemporizador);
  useEffect(() => () => t.limpiar(), [t]);
  return t;
}

/**
 * `setInterval` declarativo: corre `fn` cada `ms` mientras `ms` no sea null, siempre con la versión más nueva de `fn`,
 * y se detiene solo al desmontarse o al pasar `ms` a null.
 */
export function useIntervalo(fn: () => void, ms: number | null): void {
  const tic = useEffectEvent(fn);
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => tic(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
