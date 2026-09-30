import { useEffect, useMemo, useRef, useState } from 'react';
import { useDesbloqueo } from '@/estado/useDesbloqueo';
import { View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { runOnUI, scrollTo, useAnimatedRef, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { loadContent } from '@/data/contenido';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import { layout, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { RootStackParams } from '@/types/rutas';
import type { GramaticaTema } from '@/types';

/** Pausa entre un ejemplo y el siguiente en "Escuchar todos". */
const PAUSA_ENTRE_EJEMPLOS_MS = 600;

/** Pausa entre el inglés y el español de un mismo ejemplo. */
const PAUSA_INGLES_ESPANOL_MS = 350;

/** Lo que ocupa el encabezado arriba: un ejemplo que suena no debe quedar debajo de él. */
const RESERVA_ENCABEZADO = layout.tapMin + space.lg;

type Nav = NativeStackNavigationProp<RootStackParams>;

type R = RouteProp<RootStackParams, 'GramaticaTema'>;

/**
 * Pasos de "Escuchar todos": inglés y, si existe, español por ejemplo.
 * `ejemploDelPaso[i]` dice a qué ejemplo pertenece el paso `i`, porque
 * no todos los ejemplos aportan el mismo número de pasos.
 */
function armarPasos(ejemplos: GramaticaTema['ejemplos']) {
  const pasos: { path: string | null; pauseMs: number }[] = [];
  const ejemploDelPaso: number[] = [];
  ejemplos.forEach((e, i) => {
    if (e.audio_es) {
      pasos.push(
        { path: e.audio, pauseMs: PAUSA_INGLES_ESPANOL_MS },
        { path: e.audio_es, pauseMs: PAUSA_ENTRE_EJEMPLOS_MS }
      );
      ejemploDelPaso.push(i, i);
    } else {
      pasos.push({ path: e.audio, pauseMs: PAUSA_ENTRE_EJEMPLOS_MS });
      ejemploDelPaso.push(i);
    }
  });
  return { pasos, ejemploDelPaso };
}

/**
 * Un tema de gramática: su contenido, los ejemplos que suenan y el desbloqueo.
 */
export function useTemaGramatica() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<R>();
  const { gramatica } = loadContent();
  // Silencio total: entre la voz de los ejemplos y "Escuchar todos" la
  // música de fondo solo estorba, a diferencia de Estudio donde queda
  // más baja de fondo.
  useMusicaPantalla('silencio');
  const reducido = useMovimientoReducido();
  const scrollY = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const destinoScroll = useSharedValue(0);
  // 1 mientras el scroll lo lleva la pantalla; el dedo lo suelta (`soltarScroll` de `Screen`).
  const animandoScroll = useSharedValue(0);
  const { height: altoVentana } = useWindowDimensions();
  const { top: insetArriba, bottom: insetAbajo } = useSafeAreaInsets();

  useDerivedValue(() => {
    if (animandoScroll.get() === 0) return;
    scrollTo(scrollRef, 0, destinoScroll.get(), false);
  });

  const irAlScroll = (y: number) => {
    if (reducido) {
      runOnUI((v: number) => {
        'worklet';
        scrollTo(scrollRef, 0, v, false);
      })(y);
      return;
    }
    animandoScroll.set(1);
    destinoScroll.set(scrollY.get());
    destinoScroll.set(withTiming(y, { duration: motionDuration.lento, easing: motionEasing.entrar }, () => {
      animandoScroll.set(0);
    }));
  };

  /** Lleva la tarjeta del ejemplo que empieza a sonar a la parte visible de la pantalla, sin moverla si ya se ve. */
  const llevarAVista = (vista: View | null) => {
    vista?.measureInWindow((_x, y, _ancho, alto) => {
      const techo = insetArriba + RESERVA_ENCABEZADO;
      const piso = altoVentana - insetAbajo - space.xl;
      let delta = 0;
      if (y < techo) delta = y - techo;
      else if (y + alto > piso) delta = Math.min(y + alto - piso, y - techo);
      if (Math.abs(delta) < 1) return;
      irAlScroll(Math.max(0, scrollY.get() + delta));
    });
  };

  const tema = useMemo(
    () => gramatica.temas.find((t) => t.id === params.temaId) ?? null,
    [gramatica, params.temaId]
  );
  const muro = useDesbloqueo('gramatica', params.temaId);

  const [ejemploActivo, setEjemploActivo] = useState<number | null>(null);
  const [reproduciendoTodos, setReproduciendoTodos] = useState(false);
  // El bucle async no ve el state nuevo: playSequence necesita un ref
  // vivo para poder cortarse a media reproducción.
  const reproduciendoRef = useRef(false);
  // Cuenta las ejecuciones de "Escuchar todos". Un stop + play rápido deja
  // la ejecución vieja terminando mientras ya corre la nueva: cada una
  // solo manda si sigue siendo la vigente.
  const ejecucionRef = useRef(0);

  // Perder el foco apaga "Escuchar todos" y corta todo el audio al instante.
  useCortarAudioAlSalir(() => {
    reproduciendoRef.current = false;
    setReproduciendoTodos(false);
  });

  useEffect(() => {
    // Al salir de la pantalla (o cambiar de tema, que remonta el
    // componente porque la ruta se apila con un temaId distinto): corta
    // la voz en camino, nunca la deja sonando de fondo.
    return () => {
      reproduciendoRef.current = false;
      audio.stop();
    };
  }, [params.temaId]);

  const escucharTodos = async () => {
    if (!tema || reproduciendoRef.current) return;
    const miEjecucion = ++ejecucionRef.current;
    const esVigente = () => reproduciendoRef.current && ejecucionRef.current === miEjecucion;
    reproduciendoRef.current = true;
    setReproduciendoTodos(true);
    const { pasos, ejemploDelPaso } = armarPasos(tema.ejemplos);
    await audio.playSequence(pasos, esVigente, (paso) =>
      setEjemploActivo(ejemploDelPaso[paso] ?? null)
    );
    if (ejecucionRef.current !== miEjecucion) return;
    reproduciendoRef.current = false;
    setReproduciendoTodos(false);
    setEjemploActivo(null);
  };

  /** Suelta la secuencia sin tocar el audio: lo usan los botones sueltos. */
  const soltarSecuencia = () => {
    reproduciendoRef.current = false;
    setReproduciendoTodos(false);
    setEjemploActivo(null);
  };

  const detenerTodos = () => {
    soltarSecuencia();
    audio.stop();
  };

  /** Posición dentro de su bloque: decide si necesita anuncio. */
  const posicion = useMemo(() => {
    if (!tema) return 0;
    return gramatica.temas.filter((t) => t.bloque === tema.bloque).findIndex((t) => t.id === tema.id);
  }, [gramatica, tema]);

  return { nav, gramatica, reducido, scrollY, scrollRef, animandoScroll, llevarAVista, tema, muro, ejemploActivo, reproduciendoTodos, escucharTodos, soltarSecuencia, detenerTodos, posicion };
}
