import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, runOnJS, runOnUI, scrollTo, useAnimatedReaction, useAnimatedRef, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useOracionActual, type MedidasTexto } from '@/features/lecturas/components/TextoAcompanado';
import { useReproductorCapitulo } from '@/features/lecturas/hooks/useReproductorCapitulo';
import { partirTexto, type Trozo } from '@/domain/lectura';
import { dividirOraciones, inicioDeMarcas, inicioEstimado, trozosPorOracion } from '@/domain/oraciones';
import { getCardStates } from '@/data/repos/tarjetas';
import { getEntriesByIds } from '@/data/repos/frases';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { marcasOracionesDe } from '@/services/marcas';
import { layout, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { CardState, Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Ruta = RouteProp<RootStackParams, 'Lectura'>;

const SIN_ENTRADAS = new Map<number, Entry>();

const SIN_ESTADOS = new Map<number, CardState>();

/** Lo que ocupa el encabezado arriba del texto, en dp: para saber cuánto del texto queda a la vista. */
const RESERVA_ENCABEZADO = layout.tapMin + space.md;

/** Cuánto antes del final del texto se da por llegado, en dp. */
const MARGEN_FIN = space.xxxl;

/** Dónde queda la oración que suena al seguir el audio: a esta fracción del alto visible, desde arriba (el tercio de arriba). */
const LINEA_LECTURA = 0.28;

/** Si la oración ya está a menos de esto (dp) de su lugar, el scroll no se mueve. */
const UMBRAL_SCROLL = space.lg;

/**
 * Una lectura: el capítulo, el reproductor acompañado, las frases marcadas y las preguntas.
 */
export function useLectura() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const reducido = useMovimientoReducido();
  const user = useAuthStore((s) => s.user);
  const leyendaVista = useSettingsStore((s) => s.leyendaLecturaVista);
  const guardarAjuste = useSettingsStore((s) => s.set);
  const content = useMemo(() => loadContent(), []);
  const { height: altoVentana } = useWindowDimensions();
  const { top: insetArriba, bottom: insetAbajo } = useSafeAreaInsets();

  const lectura = useMemo(
    () => content.lecturas.lecturas.find((l) => l.id === params.lecturaId),
    [content, params.lecturaId]
  );

  const [cap, setCap] = useState(0);
  const [enPreguntas, setEnPreguntas] = useState(false);
  /** La pregunta en pantalla; al llegar a `preguntas.length` toca el cierre. */
  const [pregunta, setPregunta] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});

  const carga = useCarga(
    async () => {
      if (!user || !lectura) return null;
      const es = await getEntriesByIds(lectura.frases);
      const st = await getCardStates(user.id, lectura.frases);
      return { entradas: new Map(es.map((e) => [e.id, e])), estados: st };
    },
    [user, lectura]
  );
  const entradas = carga.datos?.entradas ?? SIN_ENTRADAS;
  const estados = carga.datos?.estados ?? SIN_ESTADOS;

  // Perder el foco (salir, cambiar de pestaña, abrir la ficha de una
  // frase) corta todo el audio: el player de frases es uno solo y compartido.
  useCortarAudioAlSalir();

  // Red de seguridad por si se desmonta sin haber perdido el foco antes.
  useEffect(
    () => () => {
      audio.stop();
    },
    []
  );

  const capitulo = lectura?.capitulos[cap];

  const trozos: Trozo[] = useMemo(() => {
    if (!capitulo) return [];
    const frases = (lectura?.frases ?? [])
      .map((id) => {
        const e = entradas.get(id);
        if (!e) return null;
        return { id, phrase: e.phrase, nueva: !estados.has(id) };
      })
      .filter((f): f is { id: number; phrase: string; nueva: boolean } =>
        Boolean(f)
      );
    return partirTexto(capitulo.texto, frases);
  }, [capitulo, lectura, entradas, estados]);

  // Las oraciones del capítulo y cuándo empieza cada una: con las marcas de Polly si existen y, si no, por caracteres.
  const oraciones = useMemo(() => (capitulo ? dividirOraciones(capitulo.texto) : []), [capitulo]);
  const porOracion = trozosPorOracion(oraciones, trozos);

  const rep = useReproductorCapitulo(capitulo?.audio ?? null);
  const repRef = useRef(rep);
  useLayoutEffect(() => {
    repRef.current = rep;
  }, [rep]);
  const duracion = rep.progreso.dur;
  const inicios = useMemo(() => {
    if (!capitulo) return [];
    return (
      inicioDeMarcas(oraciones, marcasOracionesDe(capitulo.audio), capitulo.texto.length, duracion) ??
      inicioEstimado(oraciones, duracion)
    );
  }, [capitulo, oraciones, duracion]);
  const iniciosRef = useRef(inicios);
  useLayoutEffect(() => {
    iniciosRef.current = inicios;
  }, [inicios]);
  const actual = useOracionActual(inicios, rep.pos, rep.enCurso);

  // El scroll: se publica su desplazamiento para saber si se llegó al final del texto.
  const scrollY = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const finTexto = useSharedValue(0);
  const altoPie = useSharedValue(0);
  const [alFinal, setAlFinal] = useState(false);

  useAnimatedReaction(
    () => {
      const visible = altoVentana - insetArriba - insetAbajo - altoPie.get() - RESERVA_ENCABEZADO;
      return finTexto.get() > 0 && scrollY.get() + visible >= finTexto.get() - MARGEN_FIN ? 1 : 0;
    },
    (ahora, antes) => {
      if (ahora !== antes) runOnJS(setAlFinal)(ahora === 1);
    },
    [altoVentana, insetArriba, insetAbajo]
  );

  // Seguir el audio: mientras suena, el scroll mantiene la oración que se escucha en el tercio de arriba. Si el usuario
  // toma el scroll con el dedo (`Screen` pone `siguiendo` en 0) se deja de seguir y aparece «Volver a donde va el audio».
  const siguiendo = useSharedValue(1);
  const animandoScroll = useSharedValue(0);
  const destinoScroll = useSharedValue(0);
  const inicioTexto = useSharedValue(0);
  const ysTexto = useSharedValue<number[]>([]);
  const [mostrarVolver, setMostrarVolver] = useState(false);

  useDerivedValue(() => {
    if (animandoScroll.get() === 0) return;
    scrollTo(scrollRef, 0, destinoScroll.get(), false);
  });

  /** Lleva la oración `indice` a su lugar en la pantalla; con `forzar` aunque ya esté cerca. Con reducir movimiento salta. */
  const llevarA = useCallback(
    (indice: number, forzar: boolean) => {
      'worklet';
      const y = ysTexto.get()[indice];
      if (y === undefined || y < 0) return;
      const visible = altoVentana - insetArriba - insetAbajo - altoPie.get() - RESERVA_ENCABEZADO;
      const objetivo = Math.max(0, inicioTexto.get() + y - visible * LINEA_LECTURA);
      if (!forzar && Math.abs(objetivo - scrollY.get()) < UMBRAL_SCROLL) return;
      if (reducido) {
        animandoScroll.set(0);
        scrollTo(scrollRef, 0, objetivo, false);
        return;
      }
      animandoScroll.set(1);
      destinoScroll.set(scrollY.get());
      destinoScroll.set(withTiming(objetivo, { duration: motionDuration.lento, easing: motionEasing.entrar }, () => {
        animandoScroll.set(0);
      }));
    },
    [altoVentana, insetArriba, insetAbajo, reducido, ysTexto, inicioTexto, altoPie, scrollY, scrollRef, animandoScroll, destinoScroll]
  );

  useAnimatedReaction(
    () => actual.get(),
    (i, antes) => {
      if (i < 0 || i === antes || siguiendo.get() === 0) return;
      llevarA(i, false);
    },
    [llevarA]
  );
  // El dedo toma el scroll: se suelta la animación que llevaba el texto.
  useAnimatedReaction(
    () => siguiendo.get(),
    (s) => {
      if (s !== 0) return;
      cancelAnimation(destinoScroll);
      animandoScroll.set(0);
    }
  );
  // Al empezar el audio se vuelve a seguir.
  useAnimatedReaction(
    () => rep.enCurso.get(),
    (ahora, antes) => {
      if (ahora === 1 && antes !== 1) siguiendo.set(1);
    }
  );
  useAnimatedReaction(
    () => (rep.enCurso.get() === 1 && siguiendo.get() === 0 ? 1 : 0),
    (ahora, antes) => {
      if (ahora !== antes) runOnJS(setMostrarVolver)(ahora === 1);
    }
  );

  const volverAlAudio = () => {
    runOnUI(() => {
      'worklet';
      siguiendo.set(1);
      if (actual.get() >= 0) llevarA(actual.get(), true);
    })();
  };

  // Cada capítulo empieza arriba y siguiendo.
  useEffect(() => {
    siguiendo.set(1);
    runOnUI(() => {
      'worklet';
      scrollTo(scrollRef, 0, 0, false);
    })();
  }, [cap, scrollRef, siguiendo]);

  const alMedirTexto = (m: MedidasTexto) => {
    finTexto.set(m.base + m.alto);
    inicioTexto.set(m.base);
    ysTexto.set(m.ys);
  };

  const marcarLeyenda = () => {
    if (user) void guardarAjuste(user.id, 'leyendaLecturaVista', true);
  };

  const abrirFrase = (entryId: number) => nav.navigate('Detail', { entryId });

  /** Tocar una oración mientras suena (o en pausa) lleva el audio a ella. */
  const irAOracion = (indice: number) => {
    const r = repRef.current;
    if (r.estado !== 'sonando' && r.estado !== 'pausado') return;
    haptics.tapLight();
    // Quien toca una oración quiere seguir el audio desde ahí.
    siguiendo.set(1);
    const enPausa = r.estado === 'pausado';
    void r.saltar(iniciosRef.current[indice] ?? 0).then(() => {
      if (enPausa) repRef.current.reanudar();
    });
  };

  const siguiente = () => {
    if (!lectura) return;
    audio.stop();
    if (cap + 1 < lectura.capitulos.length) {
      setCap((c) => c + 1);
      return;
    }
    setEnPreguntas(true);
  };

  const responder = (i: number, opcion: number) => {
    if (respuestas[i] !== undefined) return;
    const correcta = lectura?.preguntas[i]?.correcta;
    if (opcion === correcta) {
      haptics.success();
      void audio.playSuccess();
    } else {
      // Light, no Warning: el fallo informa, no regaña.
      haptics.tapLight();
      void audio.playFail();
    }
    setRespuestas((r) => ({ ...r, [i]: opcion }));
  };

  // Estable entre ticks del audio: si no, PieReproductor se repinta cada vez que la pantalla lo hace.
  const hayBotonSiguiente = rep.terminado || alFinal;
  const esUltimo = lectura ? cap + 1 >= lectura.capitulos.length : false;
  const botonSiguiente = (hayBotonSiguiente
        ? { etiqueta: esUltimo ? 'Ver las preguntas' : `Capítulo ${cap + 2}`, onPress: siguiente }
        : null);

  return { nav, reducido, leyendaVista, lectura, cap, enPreguntas, setEnPreguntas, pregunta, setPregunta, respuestas, carga, estados, capitulo, oraciones, porOracion, rep, actual, scrollY, scrollRef, altoPie, siguiendo, mostrarVolver, volverAlAudio, alMedirTexto, marcarLeyenda, abrirFrase, irAOracion, siguiente, responder, botonSiguiente };
}
