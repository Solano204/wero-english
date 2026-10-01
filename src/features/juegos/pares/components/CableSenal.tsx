import React, { useCallback, useEffect, useMemo, useRef, type ReactNode, useEffectEvent, useLayoutEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  runOnUI,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CableTrazo } from '@/shared/ui/fx/CableTrazo';
import { motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { centroDe, fichaEn, type Rect } from '@/features/juegos/pares/logic/geometria';

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
  'use no memo';
  // Fuera del React Compiler a propósito: los callbacks del gesto leen refs con los avisos más recientes (así el
  // gesto no se rearma a media partida, lo que cortaría un arrastre en curso) y el compilador no sabe que esos
  // callbacks corren después del render. Se queda con su memorización a mano (useMemo del gesto, useCallback).
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
  useLayoutEffect(() => {
    cb.current = { onIniciar, onSoltar, onCancelar, onUnionLista };
  }, [onIniciar, onSoltar, onCancelar, onUnionLista]);
  const alIniciar = useCallback((i: number) => cb.current.onIniciar(i), []);
  const alCancelar = useCallback(() => cb.current.onCancelar(), []);
  const alUnionLista = useCallback(() => cb.current.onUnionLista(), []);

  useEffect(() => {
    anclaSv.set(ancla);
  }, [ancla, anclaSv]);
  useEffect(() => {
    bloqueadoSv.set(bloqueado ? 1 : 0);
  }, [bloqueado, bloqueadoSv]);
  useEffect(() => {
    libresSv.set(libres.map((l) => (l ? 1 : 0)));
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
      const desdeDedo = estado.get() === SIGUE;
      ax.set(a.x);
      ay.set(a.y);
      if (!desdeDedo) {
        ex.set(a.x);
        ey.set(a.y);
      }
      estado.set(siguiente);
      vis.set(1);
      ambar.set(0);
      brillo.set(0);
      pulso.set(0);
    },
    [estado, ax, ay, ex, ey, vis, ambar, brillo, pulso]
  );

  const arrancarUnion = useCallback(
    (a: Punto, b: Punto) => {
      'worklet';
      preparar(a, UNION);
      tension.set(TENSION_INICIO);
      const llegar = { duration: motionDuration.rapido, easing: motionEasing.entrar };
      ex.set(withTiming(b.x, llegar));
      ey.set(withTiming(b.y, llegar));
      tension.set(withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
      brillo.set(withDelay(motionDuration.rapido, withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar })));
      pulso.set(withDelay(
        motionDuration.rapido,
        withTiming(1, { duration: motionDuration.base, easing: motionEasing.lineal }, (terminada) => {
          'worklet';
          if (terminada) runOnJS(alUnionLista)();
        })
      ));
      // El cable se apaga mientras las fichas empiezan a fundirse.
      vis.set(withDelay(
        motionDuration.rapido + motionDuration.base,
        withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }, (terminada) => {
          'worklet';
          if (terminada) estado.set(REPOSO);
        })
      ));
    },
    [preparar, tension, ex, ey, brillo, pulso, vis, estado, alUnionLista]
  );

  const arrancarFallo = useCallback(
    (a: Punto, b: Punto) => {
      'worklet';
      preparar(a, FALLO);
      tension.set(TENSION_FLOJA);
      // Llega, cuelga un instante y se recoge: 150 + 150 + 220 ms, la ventana de la jugada fallida.
      const llegar = { duration: motionDuration.rapido, easing: motionEasing.entrar };
      const volver = { duration: motionDuration.base, easing: motionEasing.salir };
      ex.set(withSequence(withTiming(b.x, llegar), withDelay(motionDuration.rapido, withTiming(a.x, volver))));
      ey.set(withSequence(withTiming(b.y, llegar), withDelay(motionDuration.rapido, withTiming(a.y, volver))));
      ambar.set(withTiming(1, llegar));
      vis.set(withDelay(
        motionDuration.rapido * 2,
        withTiming(0, volver, (terminada) => {
          'worklet';
          if (terminada) estado.set(REPOSO);
        })
      ));
    },
    [preparar, tension, ex, ey, ambar, vis, estado]
  );

  const recoger = useCallback(() => {
    'worklet';
    estado.set(CANCELA);
    const salir = { duration: motionDuration.base, easing: motionEasing.salir };
    ex.set(withTiming(ax.get(), salir));
    ey.set(withTiming(ay.get(), salir));
    vis.set(withTiming(0, salir, (terminada) => {
      'worklet';
      if (terminada) estado.set(REPOSO);
    }));
  }, [estado, ex, ey, ax, ay, vis]);

  /** Si el dedo se soltó sobre una ficha y aun así ninguna unión ni fallo tomó el cable, se recoge. */
  const recogerSiSigue = useCallback(() => {
    'worklet';
    if (estado.get() === SIGUE) recoger();
  }, [estado, recoger]);

  const alSoltar = useCallback(
    (i: number) => {
      cb.current.onSoltar(i);
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => runOnUI(recogerSiSigue)(), motionDuration.base);
    },
    [recogerSiSigue]
  );

  const efectoUnion = useEffectEvent(() => {
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
  });
  useEffect(() => efectoUnion(), [union]);

  const efectoFallo = useEffectEvent(() => {
    if (!fallo || reducido) return;
    const a = rectas[fallo.a];
    const b = rectas[fallo.b];
    if (a && b) runOnUI(arrancarFallo)(centroDe(a), centroDe(b));
  });
  useEffect(() => efectoFallo(), [fallo]);

  const habilitado = arrastrable && !reducido;
  const gesto = useMemo(() => {
    const puede = (i: number) => {
      'worklet';
      return i >= 0 && libresSv.get()[i] === 1 && bloqueadoSv.get() === 0 && (anclaSv.get() === -1 || anclaSv.get() === i);
    };
    const libre = (i: number) => {
      'worklet';
      return i >= 0 && libresSv.get()[i] === 1;
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
          desde.set(i);
          inicioX.set(t.x);
          inicioY.set(t.y);
        })
        .onTouchesMove((e, manejador) => {
          const t = e.allTouches[0];
          if (!t || desde.get() < 0 || estado.get() === SIGUE) return;
          if (Math.hypot(t.x - inicioX.get(), t.y - inicioY.get()) < UMBRAL_ARRASTRE) return;
          const origen = rectas[desde.get()];
          if (!origen) return;
          const c = centroDe(origen);
          cancelAnimation(vis);
          ax.set(c.x);
          ay.set(c.y);
          ex.set(t.x);
          ey.set(t.y);
          manejador.activate();
        })
        .onStart(() => {
          estado.set(SIGUE);
          tension.set(TENSION_ARRASTRE);
          ambar.set(0);
          brillo.set(0);
          pulso.set(0);
          vis.set(withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }));
          if (anclaSv.get() !== desde.get()) runOnJS(alIniciar)(desde.get());
        })
        .onUpdate((e) => {
          const sobre = fichaEn(rectas, e.x, e.y);
          const objetivo = libre(sobre) && sobre !== desde.get() ? rectas[sobre] : undefined;
          if (objetivo) {
            const c = centroDe(objetivo);
            ex.set(e.x + (c.x - e.x) * IMAN);
            ey.set(e.y + (c.y - e.y) * IMAN);
          } else {
            ex.set(e.x);
            ey.set(e.y);
          }
        })
        .onFinalize((e, exito) => {
          const origen = desde.get();
          desde.set(-1);
          if (estado.get() !== SIGUE) return;
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

  return (
    <GestureDetector gesture={gesto}>
      <View style={{ width: ancho, height: alto }}>
        {children}
        <CableTrazo ax={ax} ay={ay} ex={ex} ey={ey} tension={tension} vis={vis} brillo={brillo} ambar={ambar} pulso={pulso} />
      </View>
    </GestureDetector>
  );
}

