import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/components/base';
import { CierreLectura } from '@/components/lectura/CierreLectura';
import { EsqueletoTexto } from '@/components/lectura/EsqueletoTexto';
import { LeyendaFrases } from '@/components/lectura/LeyendaFrases';
import { PieReproductor } from '@/components/lectura/PieReproductor';
import { PreguntaUnaAUna } from '@/components/lectura/PreguntaUnaAUna';
import { TextoAcompanado, useOracionActual, type MedidasTexto } from '@/components/lectura/TextoAcompanado';
import { useReproductorCapitulo } from '@/components/lectura/useReproductorCapitulo';
import { partirTexto, type Trozo } from '@/domain/lectura';
import { dividirOraciones, inicioDeMarcas, inicioEstimado, trozosPorOracion } from '@/domain/oraciones';
import { getCardStates, getEntriesByIds } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { marcasOracionesDe } from '@/services/marcas';
import { aparecer, color, desaparecer, font, layout, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { CardState, Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

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
 * El lector.
 *
 * Las frases del catálogo van subrayadas y se pueden tocar: subrayada en gris
 * si ya las viste, punteada y en cian si son nuevas. Tocar abre la ficha
 * completa. Mientras suena el capítulo, la oración que se escucha se
 * ilumina; el reproductor va fijo abajo, en la zona del pulgar.
 *
 * Al final, tres preguntas. No se guarda calificación y no se puede
 * reprobar: son para confirmar que se entendió, no para evaluar. Poner
 * un puntaje aquí convertiría la lectura en tarea.
 */
export function LecturaScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const reducido = useMovimientoReducido();
  const user = useAuthStore((s) => s.user);
  const leyendaVista = useSettingsStore((s) => s.leyendaLecturaVista);
  const guardarAjuste = useSettingsStore((s) => s.set);
  const content = useMemo(loadContent, []);
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
  const porOracion = useMemo(() => trozosPorOracion(oraciones, trozos), [oraciones, trozos]);

  const rep = useReproductorCapitulo(capitulo?.audio ?? null);
  const repRef = useRef(rep);
  repRef.current = rep;
  const duracion = rep.progreso.dur;
  const inicios = useMemo(() => {
    if (!capitulo) return [];
    return (
      inicioDeMarcas(oraciones, marcasOracionesDe(capitulo.audio), capitulo.texto.length, duracion) ??
      inicioEstimado(oraciones, duracion)
    );
  }, [capitulo, oraciones, duracion]);
  const iniciosRef = useRef(inicios);
  iniciosRef.current = inicios;
  const actual = useOracionActual(inicios, rep.pos, rep.enCurso);

  // El scroll: se publica su desplazamiento para saber si se llegó al final del texto.
  const scrollY = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const finTexto = useSharedValue(0);
  const altoPie = useSharedValue(0);
  const [alFinal, setAlFinal] = useState(false);

  useAnimatedReaction(
    () => {
      const visible = altoVentana - insetArriba - insetAbajo - altoPie.value - RESERVA_ENCABEZADO;
      return finTexto.value > 0 && scrollY.value + visible >= finTexto.value - MARGEN_FIN ? 1 : 0;
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
    if (animandoScroll.value === 0) return;
    scrollTo(scrollRef, 0, destinoScroll.value, false);
  });

  /** Lleva la oración `indice` a su lugar en la pantalla; con `forzar` aunque ya esté cerca. Con reducir movimiento salta. */
  const llevarA = useCallback(
    (indice: number, forzar: boolean) => {
      'worklet';
      const y = ysTexto.value[indice];
      if (y === undefined || y < 0) return;
      const visible = altoVentana - insetArriba - insetAbajo - altoPie.value - RESERVA_ENCABEZADO;
      const objetivo = Math.max(0, inicioTexto.value + y - visible * LINEA_LECTURA);
      if (!forzar && Math.abs(objetivo - scrollY.value) < UMBRAL_SCROLL) return;
      if (reducido) {
        animandoScroll.value = 0;
        scrollTo(scrollRef, 0, objetivo, false);
        return;
      }
      animandoScroll.value = 1;
      destinoScroll.value = scrollY.value;
      destinoScroll.value = withTiming(objetivo, { duration: motionDuration.lento, easing: motionEasing.entrar }, () => {
        animandoScroll.value = 0;
      });
    },
    [altoVentana, insetArriba, insetAbajo, reducido, ysTexto, inicioTexto, altoPie, scrollY, scrollRef, animandoScroll, destinoScroll]
  );

  useAnimatedReaction(
    () => actual.value,
    (i, antes) => {
      if (i < 0 || i === antes || siguiendo.value === 0) return;
      llevarA(i, false);
    },
    [llevarA]
  );
  // El dedo toma el scroll: se suelta la animación que llevaba el texto.
  useAnimatedReaction(
    () => siguiendo.value,
    (s) => {
      if (s !== 0) return;
      cancelAnimation(destinoScroll);
      animandoScroll.value = 0;
    }
  );
  // Al empezar el audio se vuelve a seguir.
  useAnimatedReaction(
    () => rep.enCurso.value,
    (ahora, antes) => {
      if (ahora === 1 && antes !== 1) siguiendo.value = 1;
    }
  );
  useAnimatedReaction(
    () => (rep.enCurso.value === 1 && siguiendo.value === 0 ? 1 : 0),
    (ahora, antes) => {
      if (ahora !== antes) runOnJS(setMostrarVolver)(ahora === 1);
    }
  );

  const volverAlAudio = useCallback(() => {
    runOnUI(() => {
      'worklet';
      siguiendo.value = 1;
      if (actual.value >= 0) llevarA(actual.value, true);
    })();
  }, [siguiendo, actual, llevarA]);

  // Cada capítulo empieza arriba y siguiendo.
  useEffect(() => {
    siguiendo.value = 1;
    runOnUI(() => {
      'worklet';
      scrollTo(scrollRef, 0, 0, false);
    })();
  }, [cap, scrollRef, siguiendo]);

  const alMedirTexto = useCallback(
    (m: MedidasTexto) => {
      finTexto.value = m.base + m.alto;
      inicioTexto.value = m.base;
      ysTexto.value = m.ys;
    },
    [finTexto, inicioTexto, ysTexto]
  );

  const marcarLeyenda = useCallback(() => {
    if (user) void guardarAjuste(user.id, 'leyendaLecturaVista', true);
  }, [user, guardarAjuste]);

  const abrirFrase = useCallback((entryId: number) => nav.navigate('Detail', { entryId }), [nav]);

  /** Tocar una oración mientras suena (o en pausa) lleva el audio a ella. */
  const irAOracion = useCallback((indice: number) => {
    const r = repRef.current;
    if (r.estado !== 'sonando' && r.estado !== 'pausado') return;
    haptics.tapLight();
    // Quien toca una oración quiere seguir el audio desde ahí.
    siguiendo.value = 1;
    const enPausa = r.estado === 'pausado';
    void r.saltar(iniciosRef.current[indice] ?? 0).then(() => {
      if (enPausa) repRef.current.reanudar();
    });
  }, [siguiendo]);

  const siguiente = useCallback(() => {
    if (!lectura) return;
    audio.stop();
    if (cap + 1 < lectura.capitulos.length) {
      setCap((c) => c + 1);
      return;
    }
    setEnPreguntas(true);
  }, [cap, lectura]);

  const responder = useCallback(
    (i: number, opcion: number) => {
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
    },
    [respuestas, lectura]
  );

  // Estable entre ticks del audio: si no, PieReproductor se repinta cada vez que la pantalla lo hace.
  const hayBotonSiguiente = rep.terminado || alFinal;
  const esUltimo = lectura ? cap + 1 >= lectura.capitulos.length : false;
  const botonSiguiente = useMemo(
    () =>
      hayBotonSiguiente
        ? { etiqueta: esUltimo ? 'Ver las preguntas' : `Capítulo ${cap + 2}`, onPress: siguiente }
        : null,
    [hayBotonSiguiente, esUltimo, cap, siguiente]
  );

  if (!lectura) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Lectura" />
        <EmptyState
          title="Esa historia ya no está"
          body="Puede que se haya regenerado lecturas.json con otros ids."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  // Las preguntas llegan solo después de leer (con los datos ya cargados).
  if (enPreguntas && carga.estado === 'listo') {
    const total = lectura.preguntas.length;
    const preguntaActual = lectura.preguntas[pregunta];
    const cerrada = preguntaActual === undefined;
    const dada = respuestas[pregunta];
    const nuevas = lectura.frases.filter((id) => !estados.has(id)).length;
    // Cada botón va en el mismo lugar: «Siguiente» (o «Terminar») entra en el suyo, y el ghost sale con el cierre.
    const pieBoton = cerrada ? (
      <Button label="Volver a las lecturas" onPress={() => nav.goBack()} full size="lg" />
    ) : dada !== undefined ? (
      <Animated.View entering={reducido ? undefined : aparecer()}>
        <Button label={pregunta + 1 >= total ? 'Terminar' : 'Siguiente'} onPress={() => setPregunta((p) => p + 1)} full size="lg" />
      </Animated.View>
    ) : (
      <Button label="Salir sin contestar" variant="ghost" onPress={() => setPregunta(total)} full size="lg" />
    );
    return (
      <Screen scroll footer={pieBoton}>
        <Header
          onBack={cerrada ? () => nav.goBack() : () => setEnPreguntas(false)}
          title={cerrada ? lectura.titulo : 'Tres preguntas'}
        />
        {cerrada ? (
          <CierreLectura nuevas={nuevas} todas={Object.keys(respuestas).length === total} />
        ) : (
          <PreguntaUnaAUna
            pregunta={preguntaActual}
            indice={pregunta}
            respuesta={dada}
            onResponder={(opcion) => responder(pregunta, opcion)}
          />
        )}
      </Screen>
    );
  }

  const ultimo = cap + 1 >= lectura.capitulos.length;
  const listo = carga.estado === 'listo';
  // «Volver a donde va el audio» flota encima del pie (Screen `flotante`): si ocupara lugar dentro del pie, el pie
  // crecería y el texto brincaría. Entra y sale en su propio `Animated.View`: `Button` anima su escala en su propio nodo.
  const volver = mostrarVolver ? (
    <Animated.View
      entering={reducido ? undefined : aparecer()}
      exiting={reducido ? undefined : desaparecer(motionDuration.rapido)}
      style={styles.volver}
    >
      <Button label="Volver a donde va el audio" icon="chevron-down" variant="secondary" onPress={volverAlAudio} />
    </Animated.View>
  ) : null;
  const pie = (
    <View onLayout={(e) => (altoPie.value = e.nativeEvent.layout.height)}>
      <PieReproductor
        rep={rep}
        texto={capitulo?.texto ?? ''}
        siguiente={botonSiguiente}
      />
    </View>
  );

  // Un solo árbol desde el primer cuadro: encabezado, título, leyenda y reproductor salen del JSON y no esperan a la
  // base. Solo el texto espera (sus frases se marcan con lo que ya viste): mientras tanto, su esqueleto ocupa su lugar
  // con el mismo interlineado y se quita de golpe cuando llega.
  return (
    <Screen
      scroll
      scrollY={scrollY}
      scrollRef={scrollRef}
      soltarScroll={siguiendo}
      footer={capitulo?.audio ? pie : undefined}
      flotante={capitulo?.audio ? volver : undefined}
    >
      <Header
        onBack={() => nav.goBack()}
        title={lectura.titulo}
        subtitle={
          lectura.capitulos.length > 1
            ? `Capítulo ${cap + 1} de ${lectura.capitulos.length}`
            : undefined
        }
      />

      {capitulo ? (
        <>
          <Text style={styles.capTitulo} accessibilityRole="header" numberOfLines={2}>
            {capitulo.titulo}
          </Text>

          <LeyendaFrases vista={leyendaVista} onVista={marcarLeyenda} />

          {carga.estado === 'error' ? (
            <ErrorCarga onReintentar={carga.reintentar} />
          ) : !listo ? (
            <View style={styles.textoPendiente}>
              <EsqueletoTexto oraciones={oraciones} visible={carga.demora} />
            </View>
          ) : (
            <TextoAcompanado
              key={cap}
              oraciones={oraciones}
              porOracion={porOracion}
              actual={actual}
              enCurso={rep.enCurso}
              conAudio={Boolean(capitulo.audio) && !rep.apagado}
              onFrase={abrirFrase}
              onOracion={irAOracion}
              alMedir={alMedirTexto}
            />
          )}

          {/* Sin audio no hay pie: el botón de seguir va al final del texto. */}
          {capitulo.audio || !listo ? null : (
            <Button
              label={ultimo ? 'Ver las preguntas' : `Capítulo ${cap + 2}`}
              icon="arrow-right"
              iconAlFinal
              onPress={siguiente}
              full
              size="lg"
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Mismo margen de abajo que TextoAcompanado.
  textoPendiente: { marginBottom: space.lg },
  volver: { alignSelf: 'center' },
  capTitulo: {
    fontSize: font.size.xl,
    fontFamily: font.family.display,
    color: color.text,
    marginBottom: space.sm,
  },
});
