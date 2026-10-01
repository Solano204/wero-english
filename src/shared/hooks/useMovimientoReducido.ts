import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Si el sistema pide menos movimiento. Cambia en caliente si el usuario
 * lo activa desde ajustes con la app abierta.
 */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (vivo) setReducido(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducido
    );
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);

  return reducido;
}
