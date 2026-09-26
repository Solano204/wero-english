import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { Button, Card, EmptyState, ErrorCarga, Header, IconButton, Screen } from '@/components/base';
import { BarraSesion } from '@/components/fx';
import { getRandomEntries } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import { color, font, layout, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

const PAUSA_ENTRE_IDIOMAS_MS = 800;
// Pausa al FINAL de cada ronda (1, 2 y 3). La última es más larga: da
// tiempo a leer la frase que sigue antes de que empiece a sonar.
const PAUSA_RONDA_MS: readonly [number, number, number] = [1500, 1500, 2500];

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

  const detener = useCallback(() => {
    cicloRef.current++;
    playingRef.current = false;
    setPlaying(false);
    audio.stop();
  }, []);

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
      <Screen>
        <Header onBack={() => nav.goBack()} title="Modo oído" />
      </Screen>
    );
  }

  if (queue.length === 0) {
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

  const actual = queue[idx];
  const tieneEs = Boolean(actual?.audio_es);
  const { ronda, idioma } = interpretaPaso(tieneEs, pasoIdx);
  // Solo resalta mientras de verdad está sonando: pasoIdx se queda
  // congelado en el paso a retomar cuando está en pausa.
  const sonandoEn = playing && idioma === 'en';
  const sonandoEs = playing && idioma === 'es';

  return (
    <Screen padded={false}>
      <View style={styles.cabeza}>
        <Header onBack={() => nav.goBack()} title="Modo oído" subtitle={`${idx + 1} de ${queue.length}`} />
        <View style={styles.barra}>
          <BarraSesion hecho={idx} meta={queue.length} />
        </View>
      </View>

      <View style={styles.body}>
        <Card style={styles.card}>
          <Text style={styles.repeticion}>Repetición {ronda}/3</Text>
          <Text style={[styles.phrase, sonandoEn && styles.sonando]}>{actual?.phrase ?? ''}</Text>
          <Text style={[styles.spanish, sonandoEs && styles.sonando]}>{actual?.spanish_main ?? ''}</Text>
        </Card>

        {empezo ? null : (
          <Text style={styles.hint}>
            Guarda el teléfono. Cada frase suena en inglés y en español, tres veces, para que la repitas en voz alta.
          </Text>
        )}
      </View>

      <View style={styles.controles}>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabeza: { paddingHorizontal: space.lg, paddingTop: space.sm },
  // El halo de la barra ocupa 24 dp; se le devuelve lo que sobra para que no separe el contenido.
  barra: { marginTop: -space.sm, marginBottom: -space.sm },
  body: { flex: 1, justifyContent: 'center', gap: space.xl, paddingHorizontal: layout.screenPad },
  card: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
  repeticion: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: font.family.bodyStrong,
  },
  phrase: {
    fontSize: font.size.display,
    letterSpacing: font.size.display * -0.015,
    fontFamily: font.family.display,
    color: color.text,
    textAlign: 'center',
    lineHeight: font.size.display * 1.2,
  },
  spanish: {
    fontFamily: font.family.body,
    fontSize: font.size.lg,
    color: color.textMuted,
    textAlign: 'center',
  },
  // El idioma que está sonando ahorita, resaltado sobre el otro.
  sonando: { color: color.accent },
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
