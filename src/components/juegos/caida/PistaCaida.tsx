import React, { useCallback, useMemo, useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Group, LinearGradient, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { FxSeguro } from '@/components/fx/FxSeguro';
import { color, resplandorPiso, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import { BarraTiempo } from './BarraTiempo';
import { ALTO_PISO, MARGEN_ARRIBA, MARGEN_PISO, distanciaCaida } from './medidas';
import { PisoResplandor } from './PisoResplandor';

/** Cuánto se acercan al centro las líneas de los carriles en el borde de arriba, en fracción del ancho. */
const CONVERGENCIA = 0.07;

/** Hueco entre las dos fichas de la fila (`space.md`): las estelas van justo sobre cada una. */
const HUECO_FICHAS = space.md;

interface CarrilesProps {
  ancho: number;
  alto: number;
  y: SharedValue<number>;
  /** El largo de la estela de esta ronda (`largoEstela`). */
  largoEstela: number;
  /** 0 a 1: la estela se enciende al empezar la caída y se apaga al contestar o al llegar al piso. */
  estela: SharedValue<number>;
}

/**
 * Los dos carriles por donde cae cada ficha y la estela de cada una. Los carriles son tres líneas de
 * 1 px en `border` que se acercan un poco hacia arriba, como una perspectiva: un dibujo fijo que se
 * traza una vez por medida. La estela es un degradado corto en `accentSoft` sobre cada ficha que baja
 * con ella: en un solo grupo cuya posición sale de `y`, el mismo valor que mueve las fichas, sin
 * setState por cuadro.
 */
function Carriles({ ancho, alto, y, largoEstela, estela }: CarrilesProps) {
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

  const columna = (ancho - space.lg * 2 - HUECO_FICHAS) / 2;
  const posicion = useDerivedValue(() => [{ translateY: MARGEN_ARRIBA + y.value }]);

  return (
    <FxSeguro>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
        <Path path={trazo} style="stroke" strokeWidth={1} color={color.border} />
        <Group transform={posicion} opacity={estela}>
          {[space.lg, space.lg + columna + HUECO_FICHAS].map((x) => (
            <Rect key={x} x={x} y={-largoEstela} width={columna} height={largoEstela}>
              <LinearGradient start={vec(0, -largoEstela)} end={vec(0, 0)} colors={[resplandorPiso[0], color.accentSoft]} />
            </Rect>
          ))}
        </Group>
      </Canvas>
    </FxSeguro>
  );
}

interface Props {
  /** Para medir dónde está la pista respecto de otras piezas (a dónde vuela la ficha acertada). */
  pistaRef?: Ref<View>;
  /** La posición de la fila de fichas: el valor compartido que la mueve. */
  y: SharedValue<number>;
  /** Cuánto baja la fila hasta tocar el piso, cada vez que la pista se mide. */
  onDistancia: (distancia: number) => void;
  /** El largo de la estela de la ronda (`largoEstela`) y su intensidad de 0 a 1. */
  largoEstela: number;
  estela: SharedValue<number>;
  /** El aviso del piso solo suena con la ronda corriendo. */
  armado: boolean;
  /** El choque de las fichas contra el piso al agotarse el tiempo (0 a 1). */
  golpe: SharedValue<number>;
  /** La fila de fichas, ya colocada con `top: MARGEN_ARRIBA` y su `translateY`. */
  children: ReactNode;
}

/**
 * La pista de Caída: ocupa todo el espacio entre la instrucción y el borde de abajo. Trae los
 * carriles con la estela de las fichas, el piso con su resplandor (en posición absoluta al fondo: la ficha se detiene exacto
 * sobre él, `distanciaCaida`) y la fila de fichas encima. Con «reducir movimiento» no hay
 * carriles con perspectiva ni estela, y el tiempo es una barra que se vacía.
 */
export function PistaCaida({ pistaRef, y, onDistancia, largoEstela, estela, armado, golpe, children }: Props) {
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
    <View ref={pistaRef} style={styles.pista} onLayout={alMedir}>
      {!reducido && medida.ancho > 0 ? (
        <Carriles ancho={medida.ancho} alto={medida.alto} y={y} largoEstela={largoEstela} estela={estela} />
      ) : null}
      {medida.alto > 0 ? <PisoResplandor y={y} distancia={distanciaCaida(medida.alto)} armado={armado} golpe={golpe} /> : null}
      {reducido && medida.alto > 0 ? <BarraTiempo y={y} distancia={distanciaCaida(medida.alto)} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pista: { flex: 1 },
});
