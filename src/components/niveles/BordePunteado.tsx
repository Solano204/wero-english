import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, DashPathEffect, RoundedRect } from '@shopify/react-native-skia';
import { FxSeguro } from '@/components/fx/FxSeguro';
import { color, radius } from '@/theme';

const GROSOR = 1.5;
/** Raya y hueco del punteado (dp). */
const RAYA = 5;
const HUECO = 4;

interface Props {
  lado: number;
}

/**
 * El borde punteado de la celda que se abre con un anuncio. Va en Skia porque el
 * `borderStyle: 'dashed'` de Android pierde o pinta mal el trazo con esquinas
 * redondeadas; solo hay una celda así a la vez. Si Skia falla, la celda se queda con
 * su borde tenue y nada más.
 */
export function BordePunteado({ lado }: Props) {
  return (
    <FxSeguro>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
        <RoundedRect
          x={GROSOR / 2}
          y={GROSOR / 2}
          width={lado - GROSOR}
          height={lado - GROSOR}
          r={radius.md}
          color={color.accent}
          style="stroke"
          strokeWidth={GROSOR}
        >
          <DashPathEffect intervals={[RAYA, HUECO]} />
        </RoundedRect>
      </Canvas>
    </FxSeguro>
  );
}
