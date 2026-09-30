import { useRef, useState } from 'react';
import type { View } from 'react-native';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Dónde queda una capa en la ventana. Las mediciones (`measureInWindow`) vienen en
 * coordenadas de ventana; una capa que dibuja encima de la pantalla (los cubitos, la
 * palabra que vuela al hueco) tiene su propio origen, y esto es la resta entre los dos.
 * Pon `ref` y `alAcomodar` (onLayout) en la capa y resta `desfase` a lo medido.
 */
export function useDesfaseVentana() {
  const ref = useRef<View>(null);
  const [desfase, setDesfase] = useState({ x: 0, y: 0 });
  const alAcomodar = () => {
    ref.current?.measureInWindow((x, y) => setDesfase((d) => (d.x === x && d.y === y ? d : { x, y })));
  };
  return { ref, alAcomodar, desfase };
}
