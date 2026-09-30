import React, { useState, type ReactNode } from 'react';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { FxSeguro } from '@/shared/ui/fx/FxSeguro';
import { useVisibilidad } from '@/shared/hooks/useVisibilidad';
import { Arco } from './ArcoSenal';

interface Props {
  /** 0 a 1: dominadas / total. */
  valor: number;
  /** La aguja arranca al pasar a true (cuando ya hay datos). */
  activo: boolean;
  /** Retraso (ms) de la primera subida: la coreografía de entrada. */
  retraso?: number;
  scrollY: SharedValue<number>;
  /** Cada cambio da un empujón corto a la aguja (jalar para refrescar). */
  pulsos?: number;
  /** El número real: el lienzo es decorativo. */
  etiqueta: string;
  /** Lo que va debajo del eje de la aguja: el número y sus textos. */
  children?: ReactNode;
}

/**
 * Medidor semicircular tipo VU de consola: arco de fondo en `trackFondo`, arco de
 * valor en el degradado `senal`, marcas cada 10 % y una aguja. La aguja sale de 0,
 * se pasa un poco y se asienta con resorte (≤ 900 ms); en reposo tiembla ±0.4° cada
 * 3 s. El temblor se pausa fuera de pantalla, sin foco o en segundo plano (MOT-4) y
 * con "reducir movimiento" la aguja queda quieta en su valor (MOT-5).
 */
export function MedidorSenal({ valor, activo, retraso = 0, scrollY, pulsos = 0, etiqueta, children }: Props) {
  const [ancho, setAncho] = useState(0);
  const { ref, visible, alAcomodar } = useVisibilidad(scrollY);
  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      onLayout={(e) => {
        setAncho(e.nativeEvent.layout.width);
        alAcomodar();
      }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, Math.max(0, valor)) * 100) }}
    >
      {ancho > 0 ? (
        <FxSeguro>
          <Arco ancho={ancho} valor={valor} activo={activo} retraso={retraso} pulsos={pulsos} visible={visible} />
        </FxSeguro>
      ) : null}
      {children}
    </Animated.View>
  );
}
