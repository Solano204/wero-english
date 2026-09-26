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
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated';
import { Button, Card, Carga, EmptyState, Header, Screen, Presionable } from '@/components/base';
import { LeyendaFrases } from '@/components/lectura/LeyendaFrases';
import { PieReproductor } from '@/components/lectura/PieReproductor';
import { TextoAcompanado, useOracionActual, type MedidasTexto } from '@/components/lectura/TextoAcompanado';
import { useReproductorCapitulo } from '@/components/lectura/useReproductorCapitulo';
import { partirTexto, type Trozo } from '@/domain/lectura';
import { dividirOraciones, inicioDeMarcas, inicioEstimado, trozosPorOracion } from '@/domain/oraciones';
import { getCardStates, getEntriesByIds } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { marcasOracionesDe } from '@/services/marcas';
import { aparecer, color, font, layout, radius, space } from '@/theme';
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
  // frase) corta la voz: el player de frases es uno solo y compartido.
  useFocusEffect(
    useCallback(() => {
      return () => {
        audio.stop();
      };
    }, [])
  );

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

  // Cada capítulo empieza arriba.
  useEffect(() => {
    runOnUI(() => {
      'worklet';
      scrollTo(scrollRef, 0, 0, false);
    })();
  }, [cap, scrollRef]);

  const alMedirTexto = useCallback(
    (m: MedidasTexto) => {
      finTexto.value = m.base + m.alto;
    },
    [finTexto]
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
    const enPausa = r.estado === 'pausado';
    void r.saltar(iniciosRef.current[indice] ?? 0).then(() => {
      if (enPausa) repRef.current.reanudar();
    });
  }, []);

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
        haptics.failure();
        void audio.playFail();
      }
      setRespuestas((r) => ({ ...r, [i]: opcion }));
    },
    [respuestas, lectura]
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

  if (carga.estado !== 'listo') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Lectura" />
        <Carga carga={carga}>{() => null}</Carga>
      </Screen>
    );
  }

  if (enPreguntas) {
    const contestadas = Object.keys(respuestas).length;
    return (
      <Screen scroll>
        <Header onBack={() => setEnPreguntas(false)} title="Tres preguntas" />
        <Text style={styles.introPreguntas}>
          No se guarda calificación. Es para ver si se entendió, no para
          calificarte.
        </Text>

        {lectura.preguntas.map((p, i) => {
          const dada = respuestas[i];
          return (
            <Card key={p.pregunta} style={styles.pregunta}>
              <Text style={styles.preguntaTexto}>{p.pregunta}</Text>
              {p.opciones.map((o, k) => {
                const elegida = dada === k;
                const esCorrecta = k === p.correcta;
                const revelada = dada !== undefined;
                return (
                  <Presionable
                    key={o}
                    onPress={() => responder(i, k)}
                    disabled={revelada}
                    accessibilityRole="button"
                    accessibilityLabel={o}
                    resultado={revelada && elegida ? (esCorrecta ? 'acierto' : 'fallo') : null}
                    style={[
                      styles.opcion,
                      revelada && esCorrecta && styles.opcionBien,
                      revelada && elegida && !esCorrecta && styles.opcionMal,
                    ]}
                  >
                    <Text style={styles.opcionTexto}>{o}</Text>
                  </Presionable>
                );
              })}
              {dada !== undefined ? (
                <Animated.Text entering={reducido ? undefined : aparecer()} style={styles.porque}>
                  {p.porque}
                </Animated.Text>
              ) : null}
            </Card>
          );
        })}

        <Button
          label={
            contestadas === lectura.preguntas.length
              ? 'Listo'
              : 'Salir sin contestar'
          }
          onPress={() => nav.goBack()}
          full
          size="lg"
        />
      </Screen>
    );
  }

  const ultimo = cap + 1 >= lectura.capitulos.length;
  const pie = (
    <View onLayout={(e) => (altoPie.value = e.nativeEvent.layout.height)}>
      <PieReproductor
        rep={rep}
        texto={capitulo?.texto ?? ''}
        siguiente={
          rep.terminado || alFinal
            ? { etiqueta: ultimo ? 'Ver las preguntas' : `Capítulo ${cap + 2}`, onPress: siguiente }
            : null
        }
      />
    </View>
  );

  return (
    <Screen scroll scrollY={scrollY} scrollRef={scrollRef} footer={capitulo?.audio ? pie : undefined}>
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
          <Text style={styles.capTitulo} accessibilityRole="header">
            {capitulo.titulo}
          </Text>

          <LeyendaFrases vista={leyendaVista} onVista={marcarLeyenda} />

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

          {/* Sin audio no hay pie: el botón de seguir va al final del texto. */}
          {capitulo.audio ? null : (
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
  capTitulo: {
    fontSize: font.size.xl,
    fontFamily: font.family.display,
    color: color.text,
    marginBottom: space.sm,
  },
  introPreguntas: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    marginBottom: space.md,
  },
  pregunta: { gap: space.sm, marginBottom: space.md },
  preguntaTexto: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
  },
  opcion: {
    minHeight: layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceAlt,
  },
  opcionBien: {
    borderColor: color.correct,
    backgroundColor: color.correctSoft,
  },
  opcionMal: { borderColor: color.wrong, backgroundColor: color.wrongSoft },
  opcionTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  porque: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
});
