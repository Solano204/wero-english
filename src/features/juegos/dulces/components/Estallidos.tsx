import React, { memo, useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { FxSeguro } from '@/shared/ui/fx/FxSeguro';
import { motionDuration, motionDulces, motionEasing, pieza } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { MAX_VIVAS, TROZOS_RETRASO_MS } from '@/features/juegos/dulces/logic/tablero';

/** Un trozo de una pieza que estalló: de dónde sale y a dónde va (en el espacio de la pantalla) y su retraso. */
export interface Trozo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** El color de la pieza de la que sale: decide el tinte del trozo. */
  color: number;
  /** Lo que espera antes de salir (ms). */
  retraso: number;
}

export interface EstallidosRef {
  /** Suelta los trozos de un paso. Los que sobren del tope de `MAX_VIVAS` vivos a la vez se descartan. */
  lanzar: (trozos: Trozo[]) => void;
}

// Cada trozo son estos números seguidos en `datos`: x0, y0, x1, y1, color, inicio (ms) y retraso (ms).
const CAMPOS = 7;
const RADIO = 3.5;
/** Cuánto se curva el vuelo hacia arriba antes de llegar (dp). */
const ARCO = 18;
/** Lo que dura el vuelo de un trozo. */
const VUELO = motionDulces.vuelo;
/** Cuánto sigue pintando la capa después de cada lanzamiento: el vuelo, el retraso máximo y un respiro. */
const VIDA = VUELO + TROZOS_RETRASO_MS + motionDuration.rapido;

interface TrozosDeColorProps {
  color: number;
  datos: SharedValue<number[]>;
  reloj: SharedValue<number>;
}

/**
 * Todos los trozos de un color en un solo trazo, que se recalcula en el hilo de UI con la hora de cada cuadro:
 * cada uno vuela de su origen a su destino con suavidad (entra y sale despacio), curvándose un poco hacia
 * arriba, y se encoge al llegar.
 */
const TrozosDeColor = memo(function TrozosDeColor({ color, datos, reloj }: TrozosDeColorProps) {
  const trazo = useDerivedValue(() => {
    // `reloj` solo despierta el cálculo en cada cuadro; la hora sale de `Date.now()`.
    void reloj.value;
    const p = Skia.Path.Make();
    const d = datos.value;
    const ahora = Date.now();
    for (let i = 0; i + CAMPOS <= d.length; i += CAMPOS) {
      if (d[i + 4] !== color) continue;
      const t = ahora - (d[i + 5] as number) - (d[i + 6] as number);
      if (t < 0 || t > VUELO) continue;
      const u = t / VUELO;
      const suave = u * u * (3 - 2 * u);
      const x0 = d[i] as number;
      const y0 = d[i + 1] as number;
      const x = x0 + ((d[i + 2] as number) - x0) * suave;
      const y = y0 + ((d[i + 3] as number) - y0) * suave - ARCO * Math.sin(Math.PI * u);
      p.addCircle(x, y, RADIO * (1 - 0.55 * u));
    }
    return p;
  });
  const tinte = pieza.tintes[color % pieza.tintes.length] ?? pieza.tintes[0];
  return <Path path={trazo} color={tinte.claro} />;
});

interface Props {
  ref?: Ref<EstallidosRef>;
}

/**
 * Los trozos de las piezas que estallan, volando a la barra de su meta. Una sola capa de Skia sobre toda la
 * pantalla, sin bucle propio: solo pinta durante `VIDA` después de cada lanzamiento, movida por una animación
 * corta y con la hora de cada cuadro; nunca hay más de `MAX_VIVAS` trozos en el aire. Con «reducir movimiento»
 * no hay trozos: las barras se actualizan directo.
 */
export function Estallidos({ ref }: Props) {
  const reducido = useMovimientoReducido();
  const datos = useSharedValue<number[]>([]);
  const reloj = useSharedValue(0);
  const lista = useRef<number[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      lanzar(trozos) {
        if (reducido || trozos.length === 0) return;
        const ahora = Date.now();
        // Solo siguen los que aún están en el aire.
        const vivos: number[] = [];
        for (let i = 0; i + CAMPOS <= lista.current.length; i += CAMPOS) {
          const fin = (lista.current[i + 5] as number) + (lista.current[i + 6] as number) + VUELO;
          if (fin > ahora) vivos.push(...lista.current.slice(i, i + CAMPOS));
        }
        const cupo = Math.max(0, MAX_VIVAS - vivos.length / CAMPOS);
        const nuevos: number[] = [];
        for (const t of trozos.slice(0, cupo)) nuevos.push(t.x0, t.y0, t.x1, t.y1, t.color, ahora, t.retraso);
        lista.current = [...vivos, ...nuevos];
        datos.value = lista.current;
        reloj.value = 0;
        reloj.value = withTiming(1, { duration: VIDA, easing: motionEasing.lineal });
      },
    }),
    [reducido, datos, reloj]
  );

  if (reducido) return null;
  return (
    <FxSeguro>
      <Canvas style={styles.capa} pointerEvents="none" accessible={false}>
        {pieza.tintes.map((_, color) => (
          <TrozosDeColor key={color} color={color} datos={datos} reloj={reloj} />
        ))}
      </Canvas>
    </FxSeguro>
  );
}

const styles = StyleSheet.create({
  capa: { ...StyleSheet.absoluteFill, zIndex: 5 },
});
