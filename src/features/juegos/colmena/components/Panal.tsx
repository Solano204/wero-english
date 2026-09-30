import React from 'react';
import { View } from 'react-native';
import { ordenDesdeCentro, retrasoVuelo, type DisposicionPanal } from '@/features/juegos/colmena/logic/geometria';
import { motionColmena } from '@/theme';
import { ContornoHex } from './ContornoHex';
import { Hexagono, type Rechazo, type Vuelo } from './Hexagono';

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
/** Los señuelos caen de uno en uno, sin pasar de 150 ms en total. */
const CAE_PASO_MS = 15;
const CAE_TOPE_MS = 150;

interface Props {
  letras: readonly string[];
  disposicion: DisposicionPanal;
  colocadas: readonly Colocada[];
  rechazo: RechazoFicha | null;
  /** La ronda se resolvió: los señuelos caen y los contornos se atenúan. */
  resuelta: boolean;
  /** Se pasa a la ronda siguiente: los contornos salen hacia abajo. */
  saliendo: boolean;
  onTocar: (ficha: number) => void;
}

/**
 * El panal de fichas hexagonales: el teclado de Colmena. Los contornos van primero y todas las fichas encima, así
 * una ficha que vuela pasa por encima de las demás. Su altura es la de la disposición, y no cambia mientras las
 * fichas vuelan: la pantalla calcula los vuelos contra ella.
 */
export function Panal({ letras, disposicion: d, colocadas, rechazo, resuelta, saliendo, onTocar }: Props) {
  const rangos = ordenDesdeCentro(d.hexagonos, d.hexAncho, d.hexAlto);
  const porFicha = (new Map(colocadas.map((c) => [c.ficha, c])));
  const total = d.hexagonos.length;

  return (
    <View style={{ width: d.ancho, height: d.alto }}>
      {d.hexagonos.map((h, i) => (
        <ContornoHex
          key={`contorno-${i}`}
          x={h.x}
          y={h.y}
          ancho={d.hexAncho}
          alto={d.hexAlto}
          atenuado={resuelta}
          saliendo={saliendo}
          retrasoSalida={retrasoVuelo(rangos[i] ?? 0, total, motionColmena.salidaPaso, motionColmena.salida / 2)}
        />
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
          cae={resuelta}
          retrasoCae={retrasoVuelo(i, total, CAE_PASO_MS, CAE_TOPE_MS)}
          onTocar={onTocar}
        />
      ))}
    </View>
  );
}
