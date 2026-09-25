import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient as Degradado } from 'expo-linear-gradient';
import { Canvas, Group, LinearGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/base';
import { color, gradiente, motionSenal, radius } from '@/theme';
import { FxSeguro } from './FxSeguro';
import { useReloj, useSenalActiva } from './useSenalActiva';
import { MARGEN_PARALAJE } from './useVisibilidad';

const GROSOR_LINEA = 3;

/** Tramo de la fase entre `a` y `b`, de 0 a 1. */
function tramo(f: number, a: number, b: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (f - a) / (b - a)));
}

/** Sale rápido y llega despacio. */
function suave(u: number): number {
  'worklet';
  return 1 - (1 - u) * (1 - u) * (1 - u);
}

interface EscenaProps {
  fase: SharedValue<number>;
  ancho: number;
  alto: number;
}

/** Pares: dos fichas se deslizan, se unen con una línea cian y hacen «clic». */
function EscenaPares({ fase, ancho, alto }: EscenaProps) {
  const fichaAncho = alto * 0.46;
  const fichaAlto = alto * 0.34;
  const hueco = alto * 0.3;
  const cx = ancho / 2;
  const cy = alto / 2;
  const cerca = fichaAncho / 2 + hueco / 2;
  const lejos = ancho * 0.32;

  const izquierda = useDerivedValue(() => {
    const f = fase.value;
    const d = f < 0.5 ? lejos + (cerca - lejos) * suave(tramo(f, 0, 0.35)) : cerca + (lejos - cerca) * suave(tramo(f, 0.8, 1));
    const clic = 1 + 0.08 * Math.sin(Math.PI * tramo(f, 0.4, 0.5));
    return [{ translateX: cx - d }, { translateY: cy }, { scale: clic }];
  });
  const derecha = useDerivedValue(() => {
    const f = fase.value;
    const d = f < 0.5 ? lejos + (cerca - lejos) * suave(tramo(f, 0, 0.35)) : cerca + (lejos - cerca) * suave(tramo(f, 0.8, 1));
    const clic = 1 + 0.08 * Math.sin(Math.PI * tramo(f, 0.4, 0.5));
    return [{ translateX: cx + d }, { translateY: cy }, { scale: clic }];
  });
  const linea = useDerivedValue(() => {
    const f = fase.value;
    return [{ translateX: cx }, { translateY: cy }, { scaleX: tramo(f, 0.35, 0.45) * (1 - tramo(f, 0.8, 0.9)) }];
  });

  return (
    <>
      <Group transform={izquierda}>
        <RoundedRect x={-fichaAncho / 2} y={-fichaAlto / 2} width={fichaAncho} height={fichaAlto} r={fichaAlto * 0.28} color={color.world.dia_a_dia} />
      </Group>
      <Group transform={derecha}>
        <RoundedRect x={-fichaAncho / 2} y={-fichaAlto / 2} width={fichaAncho} height={fichaAlto} r={fichaAlto * 0.28} color={color.world.gente} />
      </Group>
      <Group transform={linea}>
        <Rect x={-hueco / 2} y={-GROSOR_LINEA / 2} width={hueco} height={GROSOR_LINEA} color={color.accent} />
      </Group>
    </>
  );
}

interface FichaCaidaProps {
  fase: SharedValue<number>;
  x: number;
  desfase: number;
  ancho: number;
  alto: number;
  recorrido: number;
  estela: number;
  tinte: string;
}

function FichaCaida({ fase, x, desfase, ancho, alto, recorrido, estela, tinte }: FichaCaidaProps) {
  const posicion = useDerivedValue(() => [
    { translateX: x },
    { translateY: ((fase.value + desfase) % 1) * recorrido - (alto + estela) },
  ]);
  return (
    <Group transform={posicion}>
      <Rect x={-ancho / 2} y={-estela} width={ancho} height={estela} opacity={0.4}>
        <LinearGradient start={vec(0, -estela)} end={vec(0, 0)} colors={['transparent', tinte]} />
      </Rect>
      <RoundedRect x={-ancho / 2} y={0} width={ancho} height={alto} r={alto * 0.28} color={tinte} />
    </Group>
  );
}

/** Caída: dos fichas bajando con una estela sutil. */
function EscenaCaida({ fase, ancho, alto }: EscenaProps) {
  const fichaAncho = alto * 0.4;
  const fichaAlto = alto * 0.3;
  const estela = fichaAlto * 1.6;
  const recorrido = alto + fichaAlto + estela;
  return (
    <>
      <FichaCaida fase={fase} x={ancho * 0.32} desfase={0} ancho={fichaAncho} alto={fichaAlto} recorrido={recorrido} estela={estela} tinte={color.world.tech} />
      <FichaCaida fase={fase} x={ancho * 0.68} desfase={0.45} ancho={fichaAncho} alto={fichaAlto} recorrido={recorrido} estela={estela} tinte={color.world.calle} />
    </>
  );
}

interface CuboProps {
  fase: SharedValue<number>;
  x: number;
  y: number;
  lado: number;
  paso: number;
  tinte: string;
  /** 1 baja una casilla en el intercambio, -1 sube, 0 se queda. */
  mov: -1 | 0 | 1;
  /** Forma parte de la línea que se desvanece. */
  encoge: boolean;
}

function Cubo({ fase, x, y, lado, paso, tinte, mov, encoge }: CuboProps) {
  const transformacion = useDerivedValue(() => {
    const f = fase.value;
    const cambio = suave(tramo(f, 0.15, 0.35)) - suave(tramo(f, 0.85, 1));
    const escala = encoge ? 1 - suave(tramo(f, 0.4, 0.55)) + suave(tramo(f, 0.85, 1)) : 1;
    return [{ translateX: x }, { translateY: y + mov * cambio * paso }, { scale: escala }];
  });
  return (
    <Group transform={transformacion}>
      <RoundedRect x={-lado / 2} y={-lado / 2} width={lado} height={lado} r={lado * 0.22} color={tinte} />
    </Group>
  );
}

/** Dulces: cuadrícula 3×3 de cubitos que hacen swap y se desvanecen. */
function EscenaDulces({ fase, ancho, alto }: EscenaProps) {
  const lado = alto * 0.24;
  const paso = lado * 1.2;
  const w = color.world;
  const cubos: { tinte: string; mov: -1 | 0 | 1; encoge: boolean }[] = [
    { tinte: w.cultura, mov: 0, encoge: false },
    { tinte: w.dia_a_dia, mov: 1, encoge: true },
    { tinte: w.calle, mov: 0, encoge: false },
    { tinte: w.dia_a_dia, mov: 0, encoge: true },
    { tinte: w.gente, mov: -1, encoge: false },
    { tinte: w.dia_a_dia, mov: 0, encoge: true },
    { tinte: w.dinero, mov: 0, encoge: false },
    { tinte: w.cultura, mov: 0, encoge: false },
    { tinte: w.calle, mov: 0, encoge: false },
  ];
  return (
    <>
      {cubos.map((c, i) => (
        <Cubo
          key={i}
          fase={fase}
          x={ancho / 2 + ((i % 3) - 1) * paso}
          y={alto / 2 + (Math.floor(i / 3) - 1) * paso}
          lado={lado}
          paso={paso}
          tinte={c.tinte}
          mov={c.mov}
          encoge={c.encoge}
        />
      ))}
    </>
  );
}

interface Escena {
  Componente: (props: EscenaProps) => React.JSX.Element;
  /** Fotograma limpio: el que se ve quieto (reducir movimiento, fuera de pantalla). */
  quieta: number;
}

const ESCENAS: Record<string, Escena> = {
  pares: { Componente: EscenaPares, quieta: 0.6 },
  caida: { Componente: EscenaCaida, quieta: 0.4 },
  dulces: { Componente: EscenaDulces, quieta: 0 },
};

interface Props {
  /** Id del modo. Los que no tienen escena muestran su ícono. */
  modo: string;
  icono: IconName;
  ancho: number;
  alto: number;
  /** true: bucle corto. false: una sola pasada al aparecer y queda en el fotograma limpio. */
  bucle: boolean;
  /** Los bucles esperan a que termine la coreografía de entrada. */
  ambiente: boolean;
  visible: SharedValue<number>;
  desfase: SharedValue<number>;
}

function IconoModo({ icono }: { icono: IconName }) {
  return (
    <View style={styles.icono}>
      <Icon name={icono} size="xl" color={color.textMuted} />
    </View>
  );
}

function Lienzo({ escena, ancho, alto, bucle, ambiente, visible, desfase }: Omit<Props, 'modo' | 'icono'> & { escena: Escena }) {
  const { activo, reducido } = useSenalActiva();
  const fase = useReloj(motionSenal.portada, {
    activo: activo && ambiente,
    reducido,
    faseQuieta: escena.quieta,
    visible,
    unaVez: !bucle,
  });
  const paralaje = useAnimatedStyle(() => ({ transform: [{ translateY: reducido ? 0 : desfase.value }] }));
  const { Componente } = escena;
  return (
    <Animated.View style={[styles.lienzo, { top: -MARGEN_PARALAJE, height: alto + MARGEN_PARALAJE * 2 }, paralaje]}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
        <Group transform={[{ translateY: MARGEN_PARALAJE }]}>
          <Componente fase={fase} ancho={ancho} alto={alto} />
        </Group>
      </Canvas>
    </Animated.View>
  );
}

/**
 * Portada de un juego. Pares, Caída y Dulces llevan una escena en Skia con su
 * bucle corto; los demás modos, su ícono, sin letras. Los bucles corren solo si
 * la tarjeta está a la vista; fuera de pantalla, sin foco o con "reducir
 * movimiento" quedan en un fotograma limpio (MOT-4 y MOT-5).
 */
export function PortadaJuego({ modo, icono, ancho, alto, bucle, ambiente, visible, desfase }: Props) {
  const escena = ESCENAS[modo];
  return (
    <View
      style={{ width: ancho, height: alto, overflow: 'hidden', borderTopLeftRadius: radius.lg - 1, borderTopRightRadius: radius.lg - 1 }}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Degradado colors={gradiente.neutro ?? [color.surface, color.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {escena ? (
        <FxSeguro fallback={<IconoModo icono={icono} />}>
          <Lienzo escena={escena} ancho={ancho} alto={alto} bucle={bucle} ambiente={ambiente} visible={visible} desfase={desfase} />
        </FxSeguro>
      ) : (
        <IconoModo icono={icono} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lienzo: { position: 'absolute', left: 0, right: 0 },
  icono: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
