import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  interpolateColor,
  runOnJS,
  runOnUI,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FxSeguro } from '@/components/fx/FxSeguro';
import { color, motionDuration, motionEasing, senal } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { centroDe, fichaEn, type Rect } from './geometria';

/** Lo que hace el cable en cada momento. Va en un valor compartido: el hilo de UI decide sin pasar por React. */
const REPOSO = 0;
const SIGUE = 1;
const UNION = 2;
const FALLO = 3;
const CANCELA = 4;

/** Lo que hay que mover el dedo desde una ficha para que sea arrastre y no un toque. */
const UMBRAL_ARRASTRE = 10;
/** Cuánto se «pega» el extremo del cable al centro de la ficha que tiene debajo. */
const IMAN = 0.6;
/** 1 es un cable tenso; con menos cuelga. */
const TENSION_ARRASTRE = 0.8;
const TENSION_INICIO = 0.5;
const TENSION_FLOJA = 0.15;
/** Lo que cuelga un cable flojo, en fracción de su largo y con tope. */
const HOLGURA_FRAC = 0.35;
const HOLGURA_MAX = 56;
const GROSOR = 3;
const GROSOR_BRILLO = 10;
const GROSOR_PULSO = 5;
const OPACIDAD_BRILLO = 0.2;
const LARGO_PULSO = 0.22;
const RADIO_ANCLA = 5;
const RADIO_PUNTA = 4;
// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const ACENTO = color.accent;
const AMBAR = color.wrong;
const LUZ = color.accent100;

interface Punto {
  x: number;
  y: number;
}

/** Un par de fichas, por índice en el tablero. */
export interface ParIndices {
  a: number;
  b: number;
}

interface Props {
  ancho: number;
  alto: number;
  rectas: readonly Rect[];
  /** Índice de la ficha elegida, o -1. */
  ancla: number;
  /** Cuáles fichas siguen en juego, por índice. */
  libres: readonly boolean[];
  /** Con el tablero congelado (pausa de voz, jugada fallida o unión en curso) no se arranca ningún arrastre. */
  bloqueado: boolean;
  /** En un tablero que scrollea el dedo es del scroll: no hay arrastre. */
  arrastrable: boolean;
  /** Acierto: el cable une el par. */
  union: ParIndices | null;
  /** Fallo: el cable llega, cuelga y se recoge. */
  fallo: ParIndices | null;
  /** El arrastre arrancó en la ficha `i` y no había ninguna elegida: elegirla. */
  onIniciar: (i: number) => void;
  /** El dedo se soltó sobre la ficha `i`: es el segundo toque. */
  onSoltar: (i: number) => void;
  /** El dedo se soltó lejos de una ficha: el cable se recoge y no se eligió nada. */
  onCancelar: () => void;
  /** Termina el pulso de luz de un acierto: las fichas ya pueden fundirse. */
  onUnionLista: () => void;
  children: ReactNode;
}

/**
 * El cable de Pares, el héroe de la pantalla. Un solo lienzo de Skia sobre el tablero;
 * todo lo que se mueve es un valor compartido en el hilo de UI y el trazo es un único
 * `SkPath` que se recalcula ahí, sin setState por cuadro.
 *
 * - Arrastre: sale de la ficha elegida (o de la primera que se toca) y sigue al dedo; sobre
 *   otra ficha se pega a su centro. Al soltar sobre una ficha cuenta como el segundo toque.
 * - Acierto: llega, se tensa y brilla en `senal`, y un pulso de luz corre de A a B.
 * - Fallo: llega flojo y ámbar, cuelga un instante y se recoge a la primera ficha.
 * - Cancelar: se recoge sin ruido.
 *
 * El arrastre es un extra: el toque y toque de siempre no cambia. Con «reducir movimiento»
 * no hay cable ni arrastre, y la unión se marca solo con el borde de las fichas.
 */
export function CableSenal({
  ancho,
  alto,
  rectas,
  ancla,
  libres,
  bloqueado,
  arrastrable,
  union,
  fallo,
  onIniciar,
  onSoltar,
  onCancelar,
  onUnionLista,
  children,
}: Props) {
  const reducido = useMovimientoReducido();

  const ax = useSharedValue(0);
  const ay = useSharedValue(0);
  const ex = useSharedValue(0);
  const ey = useSharedValue(0);
  const tension = useSharedValue(TENSION_ARRASTRE);
  const vis = useSharedValue(0);
  const brillo = useSharedValue(0);
  const ambar = useSharedValue(0);
  const pulso = useSharedValue(0);
  const estado = useSharedValue(REPOSO);
  const desde = useSharedValue(-1);
  const inicioX = useSharedValue(0);
  const inicioY = useSharedValue(0);
  const anclaSv = useSharedValue(-1);
  const bloqueadoSv = useSharedValue(0);
  const libresSv = useSharedValue<number[]>([]);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Los callbacks del padre cambian en cada render; el gesto y las animaciones llaman siempre al último.
  const cb = useRef({ onIniciar, onSoltar, onCancelar, onUnionLista });
  cb.current = { onIniciar, onSoltar, onCancelar, onUnionLista };
  const alIniciar = useCallback((i: number) => cb.current.onIniciar(i), []);
  const alCancelar = useCallback(() => cb.current.onCancelar(), []);
  const alUnionLista = useCallback(() => cb.current.onUnionLista(), []);

  useEffect(() => {
    anclaSv.value = ancla;
  }, [ancla, anclaSv]);
  useEffect(() => {
    bloqueadoSv.value = bloqueado ? 1 : 0;
  }, [bloqueado, bloqueadoSv]);
  useEffect(() => {
    libresSv.value = libres.map((l) => (l ? 1 : 0));
  }, [libres, libresSv]);
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
      [ax, ay, ex, ey, tension, vis, brillo, ambar, pulso].forEach((v) => cancelAnimation(v));
    },
    [ax, ay, ex, ey, tension, vis, brillo, ambar, pulso]
  );

  /** Prepara un cable nuevo desde A: si el dedo lo traía, arranca donde está el dedo. */
  const preparar = useCallback(
    (a: Punto, siguiente: number) => {
      'worklet';
      const desdeDedo = estado.value === SIGUE;
      ax.value = a.x;
      ay.value = a.y;
      if (!desdeDedo) {
        ex.value = a.x;
        ey.value = a.y;
      }
      estado.value = siguiente;
      vis.value = 1;
      ambar.value = 0;
      brillo.value = 0;
      pulso.value = 0;
    },
    [estado, ax, ay, ex, ey, vis, ambar, brillo, pulso]
  );

  const arrancarUnion = useCallback(
    (a: Punto, b: Punto) => {
      'worklet';
      preparar(a, UNION);
      tension.value = TENSION_INICIO;
      const llegar = { duration: motionDuration.rapido, easing: motionEasing.entrar };
      ex.value = withTiming(b.x, llegar);
      ey.value = withTiming(b.y, llegar);
      tension.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
      brillo.value = withDelay(motionDuration.rapido, withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
      pulso.value = withDelay(
        motionDuration.rapido,
        withTiming(1, { duration: motionDuration.base, easing: motionEasing.lineal }, (terminada) => {
          'worklet';
          if (terminada) runOnJS(alUnionLista)();
        })
      );
      // El cable se apaga mientras las fichas empiezan a fundirse.
      vis.value = withDelay(
        motionDuration.rapido + motionDuration.base,
        withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }, (terminada) => {
          'worklet';
          if (terminada) estado.value = REPOSO;
        })
      );
    },
    [preparar, tension, ex, ey, brillo, pulso, vis, estado, alUnionLista]
  );

  const arrancarFallo = useCallback(
    (a: Punto, b: Punto) => {
      'worklet';
      preparar(a, FALLO);
      tension.value = TENSION_FLOJA;
      // Llega, cuelga un instante y se recoge: 150 + 150 + 220 ms, la ventana de la jugada fallida.
      const llegar = { duration: motionDuration.rapido, easing: motionEasing.entrar };
      const volver = { duration: motionDuration.base, easing: motionEasing.salir };
      ex.value = withSequence(withTiming(b.x, llegar), withDelay(motionDuration.rapido, withTiming(a.x, volver)));
      ey.value = withSequence(withTiming(b.y, llegar), withDelay(motionDuration.rapido, withTiming(a.y, volver)));
      ambar.value = withTiming(1, llegar);
      vis.value = withDelay(
        motionDuration.rapido * 2,
        withTiming(0, volver, (terminada) => {
          'worklet';
          if (terminada) estado.value = REPOSO;
        })
      );
    },
    [preparar, tension, ex, ey, ambar, vis, estado]
  );

  const recoger = useCallback(() => {
    'worklet';
    estado.value = CANCELA;
    const salir = { duration: motionDuration.base, easing: motionEasing.salir };
    ex.value = withTiming(ax.value, salir);
    ey.value = withTiming(ay.value, salir);
    vis.value = withTiming(0, salir, (terminada) => {
      'worklet';
      if (terminada) estado.value = REPOSO;
    });
  }, [estado, ex, ey, ax, ay, vis]);

  /** Si el dedo se soltó sobre una ficha y aun así ninguna unión ni fallo tomó el cable, se recoge. */
  const recogerSiSigue = useCallback(() => {
    'worklet';
    if (estado.value === SIGUE) recoger();
  }, [estado, recoger]);

  const alSoltar = useCallback(
    (i: number) => {
      cb.current.onSoltar(i);
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => runOnUI(recogerSiSigue)(), motionDuration.base);
    },
    [recogerSiSigue]
  );

  useEffect(() => {
    if (!union) return undefined;
    if (reducido) {
      const t = setTimeout(() => cb.current.onUnionLista(), motionDuration.base);
      return () => clearTimeout(t);
    }
    const a = rectas[union.a];
    const b = rectas[union.b];
    if (a && b) runOnUI(arrancarUnion)(centroDe(a), centroDe(b));
    else cb.current.onUnionLista();
    return undefined;
    // Solo cuenta la unión que llega: un cambio de medidas no la reinicia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [union]);

  useEffect(() => {
    if (!fallo || reducido) return;
    const a = rectas[fallo.a];
    const b = rectas[fallo.b];
    if (a && b) runOnUI(arrancarFallo)(centroDe(a), centroDe(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallo]);

  const habilitado = arrastrable && !reducido;
  const gesto = useMemo(() => {
    const puede = (i: number) => {
      'worklet';
      return i >= 0 && libresSv.value[i] === 1 && bloqueadoSv.value === 0 && (anclaSv.value === -1 || anclaSv.value === i);
    };
    const libre = (i: number) => {
      'worklet';
      return i >= 0 && libresSv.value[i] === 1;
    };
    return (
      Gesture.Pan()
        .enabled(habilitado)
        // El arrastre solo se activa si el dedo parte de una ficha que puede iniciarlo: en las demás
        // el toque queda para el `Presionable` de la ficha.
        .manualActivation(true)
        .onTouchesDown((e, manejador) => {
          const t = e.allTouches[0];
          const i = t ? fichaEn(rectas, t.x, t.y) : -1;
          if (!t || e.numberOfTouches > 1 || !puede(i)) {
            manejador.fail();
            return;
          }
          desde.value = i;
          inicioX.value = t.x;
          inicioY.value = t.y;
        })
        .onTouchesMove((e, manejador) => {
          const t = e.allTouches[0];
          if (!t || desde.value < 0 || estado.value === SIGUE) return;
          if (Math.hypot(t.x - inicioX.value, t.y - inicioY.value) < UMBRAL_ARRASTRE) return;
          const origen = rectas[desde.value];
          if (!origen) return;
          const c = centroDe(origen);
          cancelAnimation(vis);
          ax.value = c.x;
          ay.value = c.y;
          ex.value = t.x;
          ey.value = t.y;
          manejador.activate();
        })
        .onStart(() => {
          estado.value = SIGUE;
          tension.value = TENSION_ARRASTRE;
          ambar.value = 0;
          brillo.value = 0;
          pulso.value = 0;
          vis.value = withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar });
          if (anclaSv.value !== desde.value) runOnJS(alIniciar)(desde.value);
        })
        .onUpdate((e) => {
          const sobre = fichaEn(rectas, e.x, e.y);
          const objetivo = libre(sobre) && sobre !== desde.value ? rectas[sobre] : undefined;
          if (objetivo) {
            const c = centroDe(objetivo);
            ex.value = e.x + (c.x - e.x) * IMAN;
            ey.value = e.y + (c.y - e.y) * IMAN;
          } else {
            ex.value = e.x;
            ey.value = e.y;
          }
        })
        .onFinalize((e, exito) => {
          const origen = desde.value;
          desde.value = -1;
          if (estado.value !== SIGUE) return;
          const sobre = fichaEn(rectas, e.x, e.y);
          if (exito && libre(sobre) && sobre !== origen) {
            runOnJS(alSoltar)(sobre);
            return;
          }
          recoger();
          runOnJS(alCancelar)();
        })
    );
  }, [habilitado, rectas, libresSv, bloqueadoSv, anclaSv, desde, inicioX, inicioY, estado, vis, ax, ay, ex, ey, tension, ambar, brillo, pulso, alIniciar, alSoltar, alCancelar, recoger]);

  const trazo = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const largo = Math.hypot(ex.value - ax.value, ey.value - ay.value);
    if (largo < 0.5) return p;
    const holgura = (1 - tension.value) * Math.min(largo * HOLGURA_FRAC, HOLGURA_MAX);
    p.moveTo(ax.value, ay.value);
    p.quadTo((ax.value + ex.value) / 2, (ay.value + ey.value) / 2 + holgura, ex.value, ey.value);
    return p;
  });
  const inicio = useDerivedValue(() => vec(ax.value, ay.value));
  const fin = useDerivedValue(() => vec(ex.value, ey.value));
  const opacidadBrillo = useDerivedValue(() => brillo.value * OPACIDAD_BRILLO * vis.value * (1 - ambar.value));
  const opacidadSenal = useDerivedValue(() => vis.value * (1 - ambar.value));
  const opacidadAmbar = useDerivedValue(() => vis.value * ambar.value);
  const opacidadPulso = useDerivedValue(() => (pulso.value > 0.001 ? vis.value : 0));
  const pulsoInicio = useDerivedValue(() => Math.max(0, pulso.value - LARGO_PULSO));
  const colorPunto = useDerivedValue(() => interpolateColor(ambar.value, [0, 1], [ACENTO, AMBAR]));

  return (
    <GestureDetector gesture={gesto}>
      <View style={{ width: ancho, height: alto }}>
        {children}
        {reducido ? null : (
          <FxSeguro>
            <Canvas style={styles.lienzo} pointerEvents="none" accessible={false}>
              <Path path={trazo} style="stroke" strokeWidth={GROSOR_BRILLO} strokeCap="round" color={ACENTO} opacity={opacidadBrillo} />
              <Path path={trazo} style="stroke" strokeWidth={GROSOR} strokeCap="round" opacity={opacidadSenal}>
                <LinearGradient start={inicio} end={fin} colors={senal} />
              </Path>
              <Path path={trazo} style="stroke" strokeWidth={GROSOR} strokeCap="round" color={AMBAR} opacity={opacidadAmbar} />
              <Path
                path={trazo}
                style="stroke"
                strokeWidth={GROSOR_PULSO}
                strokeCap="round"
                color={LUZ}
                start={pulsoInicio}
                end={pulso}
                opacity={opacidadPulso}
              />
              <Circle cx={ax} cy={ay} r={RADIO_ANCLA} color={colorPunto} opacity={vis} />
              <Circle cx={ex} cy={ey} r={RADIO_PUNTA} color={colorPunto} opacity={vis} />
            </Canvas>
          </FxSeguro>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // Por encima de la ficha elevada (zIndex 1): el cable sale de su centro.
  lienzo: { ...StyleSheet.absoluteFill, zIndex: 2 },
});
