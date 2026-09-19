import React from 'react';
import Svg, { Path } from 'react-native-svg';

const RUTA = {
  derecha: 'M9 6l6 6-6 6',
  abajo: 'M6 9l6 6 6-6',
  arriba: 'M6 15l6-6 6 6',
} as const;

interface Props {
  direccion?: keyof typeof RUTA;
  color: string;
  tamano?: number;
}

/** Chevron de trazo. Se dibuja con SVG para no usar glifos de texto como ícono (IA-1). */
export function Chevron({ direccion = 'derecha', color, tamano = 20 }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={RUTA[direccion]}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
