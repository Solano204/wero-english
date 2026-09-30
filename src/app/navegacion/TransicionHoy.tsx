import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Group, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import {
  Extrapolation,
  interpolate,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, motionDuration, motionEasing, radius, space } from '@/theme';
import { FxSeguro } from '@/shared/ui/fx/FxSeguro';
import { trazarBarras } from '@/shared/ui/fx/onda';
import { terminarTransicionHoy, useTransicionHoy, type Rectangulo } from '@/shared/ui/fx/estadoTransicion';

/** Alto de la línea plana: el mismo de la barra de progreso de Study. */
const GROSOR_LINEA = 6;
/** Fotograma de la onda mientras se aplana. */
const FASE_ONDA = 0.25;
/** Energía con la que empieza a aplanarse. */
const ENERGIA_INICIAL = 0.6;
/** Si algo falla, el overlay se retira solo tras este margen sobre su duración normal. */
const MARGEN_SEGURIDAD = motionDuration.lento;

function AlFallar() {
  useEffect(() => {
    terminarTransicionHoy();
  }, []);
  return null;
}

function Escena({ origen }: { origen: Rectangulo }) {
  const { width, height } = useWindowDimensions();
  const barraY = useTransicionHoy((s) => s.barraY);
  const avance = useSharedValue(0);
  const salida = useSharedValue(1);

  useEffect(() => {
    avance.value = withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar }, (termino) => {
      if (!termino) return;
      salida.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }, (listo) => {
        if (listo) runOnJS(terminarTransicionHoy)();
      });
    });
    const tope = setTimeout(
      terminarTransicionHoy,
      motionDuration.escena + motionDuration.rapido + MARGEN_SEGURIDAD
    );
    return () => clearTimeout(tope);
  }, [avance, salida]);

  const x = useDerivedValue(() => origen.x * (1 - avance.value));
  const y = useDerivedValue(() => origen.y * (1 - avance.value));
  const ancho = useDerivedValue(() => origen.width + (width - origen.width) * avance.value);
  const alto = useDerivedValue(() => origen.height + (height - origen.height) * avance.value);
  const esquina = useDerivedValue(() => radius.lg * (1 - avance.value));

  const desplazamiento = useDerivedValue(() => [{ translateX: x.value }, { translateY: y.value }]);
  const onda = useDerivedValue(() =>
    trazarBarras({
      ancho: ancho.value,
      alto: alto.value,
      fase: FASE_ONDA,
      energia: ENERGIA_INICIAL * (1 - avance.value),
      ruido: 0,
      margenAbajo: space.lg,
    })
  );
  const opacidadLinea = useDerivedValue(() => interpolate(avance.value, [0.5, 1], [0, 1], Extrapolation.CLAMP));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Canvas style={StyleSheet.absoluteFill} accessible={false}>
        <Group opacity={salida}>
          <RoundedRect x={x} y={y} width={ancho} height={alto} r={esquina} color={color.contraste} />
          <Group transform={desplazamiento}>
            <Path path={onda} color={color.accent} opacity={0.5} />
          </Group>
          {barraY === null ? null : (
            <Rect
              x={0}
              y={barraY - GROSOR_LINEA / 2}
              width={width}
              height={GROSOR_LINEA}
              color={color.accent}
              opacity={opacidadLinea}
            />
          )}
        </Group>
      </Canvas>
    </View>
  );
}

/**
 * HOY se expande hasta llenar la pantalla mientras el destino se abre por
 * debajo; la onda se aplana en la barra de progreso de Study y el overlay se
 * disuelve. Un overlay y no una transición compartida: es lo más estable en
 * Android. Vive sobre el navegador y solo existe mientras dura la transición.
 */
export function TransicionHoy() {
  const activa = useTransicionHoy((s) => s.activa);
  const origen = useTransicionHoy((s) => s.origen);
  if (!activa || !origen) return null;
  return (
    <FxSeguro fallback={<AlFallar />}>
      <Escena origen={origen} />
    </FxSeguro>
  );
}
