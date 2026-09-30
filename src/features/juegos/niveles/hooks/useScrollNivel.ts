import { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
import type { LayoutChangeEvent, ViewToken } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { offsetCentrado, type ItemLista, type Medidas } from '@/domain/niveles';
import { motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { ALTO_TRAMO } from '@/features/juegos/niveles/components/EncabezadoTramo';

/** La primera vez por sesión el scroll al nivel actual es animado; las siguientes, directo. */
let yaSeAnimo = false;

/** Que ítems cuentan como «a la vista» para saber si el nivel actual se alejó. */
export const CONFIGURACION_VISTA = { itemVisiblePercentThreshold: 40 } as const;

interface Opciones {
  medidas: Medidas;
  /** Índice del renglón del nivel actual en la lista, o -1 si no hay. */
  indiceActual: number;
  /** Ya llegaron los datos y la lista está montada. */
  hayDatos: boolean;
}

/**
 * El scroll del mapa de niveles con medidas reales, no con un alto de renglón supuesto:
 * las posiciones salen de `medidas` (las mismas que usa `getItemLayout`) y el alto de la
 * lista se mide en pantalla. Al entrar deja el nivel actual centrado en lo que se ve; la
 * primera vez por sesión baja animado (`lento`, desde una pantalla más arriba) y las
 * siguientes cae directo. Si el usuario se aleja, avisa hacia dónde quedó el actual
 * para el botón «Ir al nivel». Tocar la lista corta cualquier animación. La animación
 * corre en el hilo de UI (`scrollTo` de Reanimated); con reducir movimiento es directo.
 */
export function useScrollNivel({ medidas, indiceActual, hayDatos }: Opciones) {
  const reducido = useMovimientoReducido();
  const listaRef = useAnimatedRef<Animated.FlatList<ItemLista>>();
  const scrollY = useSharedValue(0);
  const posicion = useSharedValue(0);
  const animando = useSharedValue(0);
  /** 1 mientras la celda del nivel actual está a la vista: fuera de ella su onda no corre (MOT-4). */
  const actualEnVista = useSharedValue(1);
  const [viewport, setViewport] = useState(0);
  const [posicionada, setPosicionada] = useState(false);
  const [lejos, setLejos] = useState<'arriba' | 'abajo' | null>(null);
  const enCurso = useRef(false);
  const yaPosicionada = useRef(false);
  const indiceRef = useRef(indiceActual);
  useLayoutEffect(() => {
    indiceRef.current = indiceActual;
  }, [indiceActual]);

  useDerivedValue(() => {
    if (animando.get() === 0) return;
    scrollTo(listaRef, 0, posicion.get(), false);
  });

  const alScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
    // Si el dedo toma la lista, la animación se suelta: manda el usuario.
    onBeginDrag: () => {
      animando.set(0);
      cancelAnimation(posicion);
    },
  });

  const terminar = useCallback((llego: boolean) => {
    enCurso.current = false;
    if (llego) setLejos(null);
  }, []);

  const irA = useCallback(
    (desde: number, hasta: number, duracion: number) => {
      enCurso.current = duracion > 0;
      animando.set(1);
      posicion.set(desde);
      posicion.set(withTiming(hasta, { duration: duracion, easing: motionEasing.entrar }, (llego) => {
        animando.set(0);
        runOnJS(terminar)(Boolean(llego));
      }));
    },
    [animando, posicion, terminar]
  );

  const alMedir = (e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.height);

  useEffect(() => {
    if (!hayDatos || viewport === 0 || yaPosicionada.current) return;
    yaPosicionada.current = true;
    const objetivo = indiceActual < 0 ? 0 : offsetCentrado(medidas, indiceActual, viewport, ALTO_TRAMO);
    if (objetivo <= 0) {
      setPosicionada(true);
      return;
    }
    const animar = !yaSeAnimo && !reducido;
    yaSeAnimo = true;
    if (animar) irA(Math.max(0, objetivo - viewport), objetivo, motionDuration.lento);
    else irA(objetivo, objetivo, 0);
    // Un cuadro después de mandar el scroll: sin esto se vería un destello de la lista arriba.
    requestAnimationFrame(() => setPosicionada(true));
  }, [hayDatos, viewport, indiceActual, medidas, reducido, irA]);

  // Estable: FlatList no admite cambiar este callback en caliente.
  const [alVisibles] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const indices = viewableItems.map((v) => v.index).filter((i): i is number => i !== null);
    const actual = indiceRef.current;
    // La onda se pausa o sigue también durante un scroll programado: si no, podía quedarse quieta a la vista.
    actualEnVista.set(actual < 0 || indices.includes(actual) ? 1 : 0);
    if (enCurso.current || !yaPosicionada.current) return;
    if (indices.length === 0) return;
    if (actual < 0 || indices.includes(actual)) setLejos(null);
    else setLejos(actual > Math.max(...indices) ? 'abajo' : 'arriba');
  });

  const irAlActual = () => {
    if (indiceActual < 0) return;
    const objetivo = offsetCentrado(medidas, indiceActual, viewport, ALTO_TRAMO);
    irA(scrollY.get(), objetivo, reducido ? 0 : motionDuration.lento);
  };

  return { listaRef, scrollY, alScroll, alMedir, posicionada, lejos, alVisibles, irAlActual, actualEnVista };
}
