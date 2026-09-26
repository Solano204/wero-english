import React, { useMemo } from 'react';
import { View } from 'react-native';
import { ordenDesdeCentro, retrasoVuelo, type DisposicionPanal } from './geometria';
import { ContornoHex, Hexagono, type Rechazo, type Vuelo } from './Hexagono';

/** Una ficha que ya se puso (o va camino a su ranura): su vuelo, y a qué ranura llega. */
export interface Colocada extends Vuelo {
  ficha: number;
  ranura: number;
}

/** Una letra que no va: qué ficha fue y hacia dónde se asomó. */
export interface RechazoFicha extends Rechazo {
  ficha: number;
}

/** El panal se arma del centro hacia afuera: cada ficha espera 20 ms más que la anterior, sin pasar de 300 ms. */
const ENTRADA_PASO_MS = 20;
const ENTRADA_TOPE_MS = 300;

interface Props {
  letras: readonly string[];
  disposicion: DisposicionPanal;
  colocadas: readonly Colocada[];
  rechazo: RechazoFicha | null;
  onTocar: (ficha: number) => void;
}

/**
 * El panal de fichas hexagonales: el teclado de Colmena. Los contornos van primero y todas las fichas encima, así
 * una ficha que vuela pasa por encima de las demás. Su altura es la de la disposición, y no cambia mientras las
 * fichas vuelan: la pantalla calcula los vuelos contra ella.
 */
export function Panal({ letras, disposicion: d, colocadas, rechazo, onTocar }: Props) {
  const rangos = useMemo(() => ordenDesdeCentro(d.hexagonos, d.hexAncho, d.hexAlto), [d]);
  const porFicha = useMemo(() => new Map(colocadas.map((c) => [c.ficha, c])), [colocadas]);
  const total = d.hexagonos.length;

  return (
    <View style={{ width: d.ancho, height: d.alto }}>
      {d.hexagonos.map((h, i) => (
        <ContornoHex key={`contorno-${i}`} x={h.x} y={h.y} ancho={d.hexAncho} alto={d.hexAlto} />
      ))}
      {d.hexagonos.map((h, i) => (
        <Hexagono
          key={i}
          indice={i}
          letra={letras[i] ?? ''}
          x={h.x}
          y={h.y}
          ancho={d.hexAncho}
          alto={d.hexAlto}
          toque={d.pasoY}
          entrada={retrasoVuelo(rangos[i] ?? 0, total, ENTRADA_PASO_MS, ENTRADA_TOPE_MS)}
          vuelo={porFicha.get(i) ?? null}
          rechazo={rechazo?.ficha === i ? rechazo : null}
          onTocar={onTocar}
        />
      ))}
    </View>
  );
}
