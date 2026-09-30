import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button, EmptyState, ErrorCarga, Header, IconButton, Screen } from '@/components/base';
import { Hueso, HuesoBoton, HuesoCirculo, ProveedorEsqueleto } from '@/components/esqueleto';
import { AnilloRadio, BarraSesion, FraseKaraoke, PuntosRepeticion, useBolsillo, useVozEnVivo } from '@/components/fx';
import { getRandomEntries } from '@/data/repos/frases';
import { analizar } from '@/domain/marcas';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import { marcasDe } from '@/services/marcas';
import { color, desaparecer, font, fraseEntra, fraseSale, layout, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

const PAUSA_ENTRE_IDIOMAS_MS = 800;
// Pausa al FINAL de cada ronda (1, 2 y 3). La última es más larga: da
// tiempo a leer la frase que sigue antes de que empiece a sonar.
const PAUSA_RONDA_MS: readonly [number, number, number] = [1500, 1500, 2500];

/** Diámetro del anillo: con poco alto (menos de 700 dp) baja para que todo quepa sin scroll. */
const ANILLO = 176;
const ANILLO_COMPACTO = 144;
const ALTO_COMPACTO = 700;

// Copias locales: un worklet captura un texto, no el objeto de tema entero.
const APAGADA = color.textMuted;
const ENCENDIDA = color.text;

/**
 * Arma los pasos de una frase: inglés, pausa corta, español, pausa de
 * ronda — tres veces. Sin español, solo suena el inglés las tres
 * veces (nunca se salta la frase por eso).
 */
function pasosFrase(
  audioEn: string,
  audioEs: string | null
): { path: string | null; pauseMs: number }[] {
  const pasos: { path: string | null; pauseMs: number }[] = [];
  for (let ronda = 0; ronda < 3; ronda++) {
    const pausaRonda = PAUSA_RONDA_MS[ronda]!;
    if (audioEs) {
      pasos.push({ path: audioEn, pauseMs: PAUSA_ENTRE_IDIOMAS_MS });
      pasos.push({ path: audioEs, pauseMs: pausaRonda });
    } else {
      pasos.push({ path: audioEn, pauseMs: pausaRonda });
    }
  }
  return pasos;
}

/** A qué ronda (1-3) y qué idioma corresponde el paso `i` de pasosFrase(). */
function interpretaPaso(
  tieneEs: boolean,
  i: number
): { ronda: 1 | 2 | 3; idioma: 'en' | 'es' } {
  if (!tieneEs) {
    return { ronda: (Math.min(i, 2) + 1) as 1 | 2 | 3, idioma: 'en' };
  }
  return {
    ronda: (Math.min(Math.floor(i / 2), 2) + 1) as 1 | 2 | 3,
    idioma: i % 2 === 0 ? 'en' : 'es',
  };
}

/** La traducción: en `textMuted` y se enciende cuando suena el español. Con «reducir movimiento» solo cambia el color. */
function Traduccion({ texto, luz }: { texto: string; luz: boolean }) {
  const reducido = useMovimientoReducido();
  const encendida = useSharedValue(luz ? 1 : 0);

  useEffect(() => {
    const destino = luz ? 1 : 0;
    encendida.value = reducido ? destino : withTiming(destino, { duration: motionDuration.base, easing: motionEasing.entrar });
  }, [luz, reducido, encendida]);

  const estilo = useAnimatedStyle(() => ({ color: interpolateColor(encendida.value, [0, 1], [APAGADA, ENCENDIDA]) }));
  return <Animated.Text style={[styles.spanish, estilo]}>{texto}</Animated.Text>;
}

/**
 * P-09, el Modo Oído.
 *
 * Reproduce frase, pausa y sigue, sin que el usuario toque nada. Es para
 * el camión y para lavar trastes. Por eso la pantalla es enorme y solo
 * tiene un botón principal: no se mira, se escucha.
 */
export function EarModeScreen() {
  useKeepAwake();
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const { height: altoVentana } = useWindowDimensions();
  useMusicaPantalla('silencio');

  const [queue, setQueue] = useState<Entry[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Ya se le dio a «Empezar» alguna vez: antes de eso el botón no puede decir «Reanudar».
  const [empezo, setEmpezo] = useState(false);
  // Paso (0-based) dentro de pasosFrase() de la frase actual. Sirve
  // para mostrar "Repetición X/3" y para que "reanudar" retome ESE
  // paso en vez de reiniciar la frase desde la ronda 1.
  const [pasoIdx, setPasoIdx] = useState(0);

  // Refs además del state: el bucle asíncrono no ve el state nuevo.
  const playingRef = useRef(false);
  const pasoIdxRef = useRef(0);
  const idxRef = useRef(0);
  // Cada vez que se pausa o se salta de frase el ciclo sube: un bucle viejo que sigue esperando su audio o su
  // pausa ya no es el vigente y termina sin tocar nada, aunque `playingRef` haya vuelto a ser true.
  const cicloRef = useRef(0);

  const carga = useCarga(
    async () => {
      if (!user) return;
      const list = await getRandomEntries(filter(), 40, { conAudio: true });
      setQueue(list.filter((e) => e.audio_en));
    },
    [user, filter]
  );
  const loading = carga.estado === 'cargando';

  // Las dos voces de la frase actual (son audios distintos) y sus tiempos de palabra: el karaoke del inglés y la onda
  // de cualquiera de las dos. Lo que se dice puede diferir de lo que se ve: los tiempos se calculan sobre lo dicho.
  const actual = queue[idx];
  const vozEn = useVozEnVivo(actual?.audio_en ?? null);
  const vozEs = useVozEnVivo(actual?.audio_es ?? null);
  const analisisEn = useMemo(
    () =>
      actual ? analizar(actual.phrase, actual.phrase_tts || actual.phrase, marcasDe(actual.audio_en), vozEn.duracion) : null,
    [actual, vozEn.duracion]
  );
  const analisisEs = useMemo(
    () =>
      actual?.audio_es
        ? analizar(actual.spanish_main, actual.spanish_main, marcasDe(actual.audio_es), vozEs.duracion)
        : null,
    [actual, vozEs.duracion]
  );

  // Modo bolsillo: sin tocar la pantalla mientras suena, baja el brillo de todo menos el anillo y la frase.
  const { bolsillo, brillo, despertar } = useBolsillo(playing);
  const estiloBrillo = useAnimatedStyle(() => ({ opacity: brillo.value }));

  const detener = useCallback(() => {
    cicloRef.current++;
    playingRef.current = false;
    setPlaying(false);
    audio.stop();
  }, []);

  // Perder el foco apaga el bucle (playingRef/cicloRef) y corta todo el
  // audio al instante, sin esperar a que el bucle note el cambio de ruta.
  useCortarAudioAlSalir(detener);

  useEffect(() => {
    // Al salir de la pantalla o ir a background: corta la voz y el
    // bucle. stop() ya invalida cualquier playAndWait() en camino.
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active' && playingRef.current) detener();
    });
    return () => {
      sub.remove();
      cicloRef.current++;
      playingRef.current = false;
      audio.stop();
    };
  }, [detener]);

  /** Reproduce una frase completa (o desde el paso `desde`, al reanudar). */
  const reproduceFrase = useCallback(async (entry: Entry, desde: number, vigente: () => boolean) => {
    const pasos = pasosFrase(entry.audio_en, entry.audio_es);
    await audio.playSequence(pasos.slice(desde), vigente, (i) => {
      pasoIdxRef.current = desde + i;
      setPasoIdx(desde + i);
    });
  }, []);

  const loop = useCallback(
    async (desdeIdx: number, desdePaso: number) => {
      const ciclo = ++cicloRef.current;
      const vigente = () => playingRef.current && cicloRef.current === ciclo;
      let i = desdeIdx;
      let desde = desdePaso;
      while (vigente() && i < queue.length) {
        const e = queue[i];
        if (!e) break;
        idxRef.current = i;
        setIdx(i);

        await reproduceFrase(e, desde, vigente);
        desde = 0; // solo la frase reanudada arranca a media secuencia

        if (!vigente()) return; // se pausó a media frase, o se saltó a otra
        i++;
      }
      if (vigente()) {
        playingRef.current = false;
        setPlaying(false);
      }
    },
    [queue, reproduceFrase]
  );

  const alternar = useCallback(() => {
    if (playingRef.current) {
      // Pausar corta el audio ya. pasoIdxRef se queda tal cual: es lo
      // que usa "reanudar" para retomar desde ese mismo paso.
      detener();
      return;
    }
    playingRef.current = true;
    setPlaying(true);
    setEmpezo(true);
    void loop(idxRef.current, pasoIdxRef.current);
  }, [loop, detener]);

  /** Anterior (-1) y siguiente (+1): la frase de destino empieza desde su primera repetición. */
  const saltar = useCallback(
    (delta: 1 | -1) => {
      const destino = idxRef.current + delta;
      if (destino < 0 || destino >= queue.length) return;
      cicloRef.current++;
      audio.stop();
      idxRef.current = destino;
      setIdx(destino);
      pasoIdxRef.current = 0;
      setPasoIdx(0);
      // Si estaba sonando, la frase nueva sigue sonando; si estaba en pausa, queda lista y en pausa.
      if (playingRef.current) void loop(destino, 0);
    },
    [queue.length, loop]
  );

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Modo oído" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen transicionCarga={carga.demora ? 'esqueleto' : undefined}>
        <Header onBack={() => nav.goBack()} title="Modo oído" />
        {carga.demora ? (
          <ProveedorEsqueleto etiqueta="Preparando el modo oído" style={styles.esqueletoRaiz}>
            <HuesoCirculo diametro={176} style={styles.esqueletoCentrado} />
            <View style={styles.esqueletoTexto}>
              <Hueso width="80%" height={22} style={styles.esqueletoCentrado} />
              <Hueso width="55%" height={16} style={styles.esqueletoCentrado} />
            </View>
            <HuesoBoton size="lg" style={styles.esqueletoCentrado} width={220} />
          </ProveedorEsqueleto>
        ) : null}
      </Screen>
    );
  }

  if (queue.length === 0 || !actual) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Modo oído" />
        <EmptyState
          icon="volume-off"
          title="Sin audio todavía"
          body="Este modo usa frases que ya estudiaste y que tengan audio descargado."
          actionLabel="Ir a estudiar"
          onAction={() => nav.replace('Study')}
        />
      </Screen>
    );
  }

  const tieneEs = Boolean(actual.audio_es);
  const { ronda, idioma } = interpretaPaso(tieneEs, pasoIdx);
  // Solo resalta mientras de verdad está sonando: pasoIdx se queda
  // congelado en el paso a retomar cuando está en pausa.
  const sonandoEs = playing && idioma === 'es';
  const suena = sonandoEs ? vozEs : vozEn;
  const envolvente = (sonandoEs ? analisisEs : analisisEn)?.envolvente ?? [];

  return (
    <Screen padded={false} transicionCarga={carga.huboEsqueleto ? 'contenido' : undefined}>
      {/* Cualquier toque despierta la pantalla, sin quitárselo a quien lo recibe (devuelve false). */}
      <View
        style={styles.flex}
        onStartShouldSetResponderCapture={() => {
          despertar();
          return false;
        }}
      >
      <Animated.View style={[styles.cabeza, estiloBrillo]}>
        <Header onBack={() => nav.goBack()} title="Modo oído" subtitle={`${idx + 1} de ${queue.length}`} />
        <View style={styles.barra}>
          <BarraSesion hecho={idx} meta={queue.length} />
        </View>
      </Animated.View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <AnilloRadio
          voz={suena}
          envolvente={envolvente}
          diametro={altoVentana < ALTO_COMPACTO ? ANILLO_COMPACTO : ANILLO}
          idioma={idioma}
          activo={playing}
          bolsillo={bolsillo}
        />

        <Animated.View key={actual.id} entering={fraseEntra()} exiting={fraseSale()} style={styles.frase}>
          {analisisEn ? <FraseKaraoke palabras={analisisEn.palabras} voz={vozEn} tamano="display" apagada={sonandoEs} /> : null}
          <Traduccion texto={actual.spanish_main} luz={sonandoEs} />
          <Animated.View style={estiloBrillo}>
            <PuntosRepeticion ronda={ronda} />
          </Animated.View>
        </Animated.View>

        {empezo ? null : (
          <Animated.Text exiting={desaparecer()} style={[styles.hint, estiloBrillo]}>
            Guarda el teléfono. Cada frase suena en inglés y en español, tres veces, para que la repitas en voz alta.
          </Animated.Text>
        )}
      </ScrollView>

      <Animated.View style={[styles.controles, estiloBrillo]}>
        <IconButton icono="previous" etiqueta="Anterior" tamano="lg" onPress={() => saltar(-1)} disabled={idx === 0} />
        <Button
          label={playing ? 'Pausar' : empezo ? 'Reanudar' : 'Empezar'}
          icon={playing ? 'pause' : 'play'}
          onPress={alternar}
          size="lg"
          style={styles.principal}
        />
        <IconButton
          icono="next"
          etiqueta="Siguiente"
          tamano="lg"
          onPress={() => saltar(1)}
          disabled={idx >= queue.length - 1}
        />
      </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  esqueletoRaiz: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xxl, paddingHorizontal: space.xl },
  esqueletoCentrado: { alignSelf: 'center' },
  esqueletoTexto: { gap: space.sm, alignItems: 'center' },
  flex: { flex: 1 },
  cabeza: { paddingHorizontal: space.lg, paddingTop: space.sm },
  // El halo de la barra ocupa 24 dp; se le devuelve lo que sobra para que no separe el contenido.
  barra: { marginTop: -space.sm, marginBottom: -space.sm },
  // El contenido se centra entre el encabezado y los controles; si una frase larga no cabe, la zona hace scroll.
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: layout.screenPad,
    paddingVertical: space.md,
  },
  frase: { alignSelf: 'stretch', alignItems: 'center', gap: space.md },
  spanish: {
    fontFamily: font.family.body,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.3,
    textAlign: 'center',
  },
  hint: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textFaint,
    textAlign: 'center',
    lineHeight: font.size.md * 1.5,
    paddingHorizontal: space.lg,
  },
  // Los controles van fijos abajo, con el aspecto del footer de `Screen`, en la zona del pulgar.
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: layout.screenPad,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.borderStrong,
    backgroundColor: color.bgFin,
  },
  principal: { flex: 1 },
});
