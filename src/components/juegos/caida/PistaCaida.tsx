import React, { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { FxSeguro } from '@/components/fx/FxSeguro';
import { color, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { ALTO_PISO, MARGEN_PISO, distanciaCaida } from './medidas';
import { PisoResplandor } from './PisoResplandor';

/** Cuánto se acercan al centro las líneas de los carriles en el borde de arriba, en fracción del ancho. */
const CONVERGENCIA = 0.07;

interface CarrilesProps {
  ancho: number;
  alto: number;
}

/**
 * Los dos carriles por donde cae cada ficha: tres líneas de 1 px en `border` que se acercan un poco
 * hacia arriba, como una perspectiva. Es un dibujo fijo (no se mueve nada): se traza una vez por medida.
 */
function Carriles({ ancho, alto }: CarrilesProps) {
  const trazo = useMemo(() => {
    const p = Skia.Path.Make();
    const izquierda = space.lg;
    const derecha = ancho - space.lg;
    const centro = ancho / 2;
    const cierre = ancho * CONVERGENCIA;
    const piso = alto - MARGEN_PISO - ALTO_PISO;
    p.moveTo(izquierda, piso);
    p.lineTo(izquierda + cierre, 0);
    p.moveTo(centro, piso);
    p.lineTo(centro, 0);
    p.moveTo(derecha, piso);
    p.lineTo(derecha - cierre, 0);
    return p;
  }, [ancho, alto]);

  return (
    <FxSeguro>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
        <Path path={trazo} style="stroke" strokeWidth={1} color={color.border} />
      </Canvas>
    </FxSeguro>
  );
}

interface Props {
  /** La posición de la fila de fichas: el valor compartido que la mueve. */
  y: SharedValue<number>;
  /** Cuánto baja la fila hasta tocar el piso, cada vez que la pista se mide. */
  onDistancia: (distancia: number) => void;
  /** La fila de fichas, ya colocada con `top: MARGEN_ARRIBA` y su `translateY`. */
  children: ReactNode;
}

/**
 * La pista de Caída: ocupa todo el espacio entre la instrucción y el borde de abajo. Trae los
 * carriles, el piso con su resplandor (en posición absoluta al fondo: la ficha se detiene exacto
 * sobre él, `distanciaCaida`) y la fila de fichas encima. Con «reducir movimiento» no hay
 * carriles con perspectiva.
 */
export function PistaCaida({ y, onDistancia, children }: Props) {
  const reducido = useMovimientoReducido();
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });

  const alMedir = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setMedida((m) => (m.ancho === width && m.alto === height ? m : { ancho: width, alto: height }));
      onDistancia(distanciaCaida(height));
    },
    [onDistancia]
  );

  return (
    <View style={styles.pista} onLayout={alMedir}>
      {!reducido && medida.ancho > 0 ? <Carriles ancho={medida.ancho} alto={medida.alto} /> : null}
      {medida.alto > 0 ? <PisoResplandor y={y} distancia={distanciaCaida(medida.alto)} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pista: { flex: 1 },
});
