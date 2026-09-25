import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, DashPathEffect, RoundedRect } from '@shopify/react-native-skia';
import { color, radius } from '@/theme';
import { FxSeguro } from './FxSeguro';

const GROSOR = 1.5;
/** Raya y hueco del punteado (dp). */
const RAYA = 5;
const HUECO = 4;

interface Props {
  ancho: number;
  alto: number;
  /** El color del trazo: `accent` para la celda que se abre con un anuncio, `textFaint` para el sello de un par. */
  tono?: string;
}

/**
 * Un borde punteado con las esquinas de una ficha. Va en Skia porque el
 * `borderStyle: 'dashed'` de Android pierde o pinta mal el trazo con esquinas
 * redondeadas. Lo usan la celda de Niveles que se abre con un anuncio y el sello que
 * deja un par resuelto en Pares; pocos a la vez y sin animación propia (quien lo trae
 * le da opacidad). Si Skia falla, queda la pieza con su borde tenue y nada más.
 */
export function BordePunteado({ ancho, alto, tono = color.accent }: Props) {
  return (
    <FxSeguro>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
        <RoundedRect
          x={GROSOR / 2}
          y={GROSOR / 2}
          width={ancho - GROSOR}
          height={alto - GROSOR}
          r={radius.md}
          color={tono}
          style="stroke"
          strokeWidth={GROSOR}
        >
          <DashPathEffect intervals={[RAYA, HUECO]} />
        </RoundedRect>
      </Canvas>
    </FxSeguro>
  );
}
