import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, Circle, Group, Path, Skia, SweepGradient, vec } from '@shopify/react-native-skia';
import Animated, {
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { color, motionDuration, motionEasing, motionSenal, motionSpring, senal } from '@/theme';
import { FxSeguro } from './FxSeguro';
import { useReloj, useSenalActiva } from './useSenalActiva';
import { useVisibilidad } from './useVisibilidad';

/** Grosor del arco. */
const TRAZO = 14;
/** Radio del semicírculo: se ajusta al ancho, hasta este tope. */
const RADIO_MAX = 150;
const CUBO = 8;
const MARCA_CORTA = 6;
const MARCA_LARGA = 12;
const MARCA_HUECO = 4;
const AGUJA_HUECO = 4;
/** Aire arriba del arco para las marcas. */
const MARGEN = TRAZO / 2 + MARCA_HUECO + MARCA_LARGA;
/** Cuánto se pasa la aguja del valor antes de asentarse, en grados. */
const SOBREPASO_GRADOS = 8;
/** Empujón de la aguja al refrescar. */
const EMPUJE_GRADOS = 5;
/** Amplitud del temblor en reposo: casi imperceptible. */
const TEMBLOR_GRADOS = 0.4;

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

interface ArcoProps {
  ancho: number;
  valor: number;
  activo: boolean;
  retraso: number;
  pulsos: number;
  visible: SharedValue<number>;
}

function Arco({ ancho, valor, activo, retraso, pulsos, visible }: ArcoProps) {
  const { activo: viva, reducido } = useSenalActiva();
  const fase = useReloj(motionSenal.temblor, { activo: viva && activo, reducido, visible });
  const angulo = useSharedValue(0);
  const empuje = useSharedValue(0);
  const temblor = useSharedValue(0);
  const primeraSubida = useRef(true);
  const primerPulso = useRef(true);

  const radio = Math.min(ancho / 2 - TRAZO / 2, RADIO_MAX);
  const cx = ancho / 2;
  const cy = MARGEN + radio;
  const alto = cy + CUBO + TRAZO / 2;
  const objetivo = Math.min(1, Math.max(0, valor)) * 180;

  const arco = useMemo(() => {
    const trazo = Skia.Path.Make();
    trazo.addArc(Skia.XYWHRect(cx - radio, cy - radio, radio * 2, radio * 2), 180, 180);
    return trazo;
  }, [cx, cy, radio]);
  const marcas = useMemo(() => {
    const trazo = Skia.Path.Make();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i * Math.PI) / 10;
      const desde = radio + TRAZO / 2 + MARCA_HUECO;
      const hasta = desde + (i % 5 === 0 ? MARCA_LARGA : MARCA_CORTA);
      trazo.moveTo(cx + Math.cos(a) * desde, cy + Math.sin(a) * desde);
      trazo.lineTo(cx + Math.cos(a) * hasta, cy + Math.sin(a) * hasta);
    }
    return trazo;
  }, [cx, cy, radio]);
  // La aguja se dibuja apuntando a la izquierda (0 %) y gira en el sentido del reloj hasta la derecha (100 %).
  const aguja = useMemo(() => {
    const trazo = Skia.Path.Make();
    trazo.moveTo(cx - CUBO, cy);
    trazo.lineTo(cx - (radio - TRAZO / 2 - AGUJA_HUECO), cy);
    return trazo;
  }, [cx, cy, radio]);

  useEffect(() => {
    if (!activo) return;
    if (reducido) {
      angulo.value = objetivo;
      return;
    }
    const espera = primeraSubida.current ? retraso : 0;
    primeraSubida.current = false;
    // Sube hasta pasarse un poco y se asienta con resorte: el total es fijo (`aguja` + `motionSpring.aguja`).
    angulo.value = withDelay(
      espera,
      withSequence(
        withTiming(Math.min(180, objetivo + SOBREPASO_GRADOS), { duration: motionSenal.aguja, easing: motionEasing.entrar }),
        withSpring(objetivo, motionSpring.aguja)
      )
    );
  }, [activo, objetivo, reducido, retraso, angulo]);

  useEffect(() => {
    if (primerPulso.current) {
      primerPulso.current = false;
      return;
    }
    if (reducido) return;
    empuje.value = withSequence(
      withTiming(EMPUJE_GRADOS, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withSpring(0, motionSpring.aguja)
    );
  }, [pulsos, reducido, empuje]);

  // El temblor solo existe con la pantalla viva y a la vista; si no, la aguja queda exacta.
  useEffect(() => {
    temblor.value = withTiming(viva && activo && !reducido ? 1 : 0, {
      duration: motionDuration.base,
      easing: motionEasing.entrar,
    });
  }, [viva, activo, reducido, temblor]);

  const rotacion = useDerivedValue(() => {
    const t = Math.sin(2 * Math.PI * fase.value) * 0.6 + Math.sin(6 * Math.PI * fase.value + 1.3) * 0.4;
    const grados = angulo.value + empuje.value + t * TEMBLOR_GRADOS * temblor.value;
    return [{ rotate: (grados * Math.PI) / 180 }];
  });
  const finArco = useDerivedValue(() => Math.min(1, Math.max(0, angulo.value / 180)));
  const arcoVisible = useDerivedValue(() => (angulo.value > 0.4 ? 1 : 0));
  // El degradado abarca lo lleno, no el semicírculo entero: con poco valor también se ve de punta a punta.
  const finBarrido = useDerivedValue(() => 180 + Math.max(2, Math.min(180, angulo.value)));

  return (
    <Canvas style={{ width: ancho, height: alto }} pointerEvents="none" accessible={false}>
      <Path path={arco} style="stroke" strokeWidth={TRAZO} strokeCap="round" color={color.trackFondo} />
      <Path path={arco} style="stroke" strokeWidth={TRAZO} strokeCap="round" start={0} end={finArco} opacity={arcoVisible}>
        <SweepGradient c={vec(cx, cy)} start={180} end={finBarrido} colors={senal} />
      </Path>
      <Path path={marcas} style="stroke" strokeWidth={2} strokeCap="round" color={color.textFaint} />
      <Group transform={rotacion} origin={vec(cx, cy)}>
        <Path path={aguja} style="stroke" strokeWidth={3} strokeCap="round" color={color.accent100} />
      </Group>
      <Circle cx={cx} cy={cy} r={CUBO} color={color.accent100} />
      <Circle cx={cx} cy={cy} r={CUBO / 2.5} color={color.surface} />
    </Canvas>
  );
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
