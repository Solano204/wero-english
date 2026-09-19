import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Button, Card, EmptyState, Header, Screen } from '@/components/base';
import { getRandomEntries } from '@/db/queries';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import { color, font, space } from '@/theme';
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
 * tiene un botón: no se mira, se escucha.
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
  const [loading, setLoading] = useState(true);
  // Paso (0-based) dentro de pasosFrase() de la frase actual. Sirve
  // para mostrar "Repetición X/3" y para que "reanudar" retome ESE
  // paso en vez de reiniciar la frase desde la ronda 1.
  const [pasoIdx, setPasoIdx] = useState(0);

  // Refs además del state: el bucle asíncrono no ve el state nuevo.
  const playingRef = useRef(false);
  const pasoIdxRef = useRef(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!user) return;
    void getRandomEntries(filter(), 40, { conAudio: true }).then((list) => {
      setQueue(list.filter((e) => e.audio_en));
      setLoading(false);
    });
  }, [user, filter]);

  const detener = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    audio.stop();
    cancelAnimation(pulse);
    pulse.value = withTiming(1);
  }, [pulse]);

  useEffect(() => {
    // Al salir de la pantalla o ir a background: corta la voz y el
    // bucle. stop() ya invalida cualquier playAndWait() en camino.
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active' && playingRef.current) detener();
    });
    return () => {
      sub.remove();
      playingRef.current = false;
      audio.stop();
      cancelAnimation(pulse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  /** Reproduce una frase completa (o desde el paso `desde`, al reanudar). */
  const reproduceFrase = useCallback(async (entry: Entry, desde: number) => {
    const pasos = pasosFrase(entry.audio_en, entry.audio_es);
    await audio.playSequence(
      pasos.slice(desde),
      () => playingRef.current,
      (i) => {
        pasoIdxRef.current = desde + i;
        setPasoIdx(desde + i);
      }
    );
  }, []);

  const loop = useCallback(
    async (desdePaso: number) => {
      let i = idx;
      let desde = desdePaso;
      while (playingRef.current && i < queue.length) {
        const e = queue[i];
        if (!e) break;
        setIdx(i);

        await reproduceFrase(e, desde);
        desde = 0; // solo la frase reanudada arranca a media secuencia

        if (!playingRef.current) return; // se pausó a media frase
        i++;
      }
      if (playingRef.current) {
        playingRef.current = false;
        setPlaying(false);
        cancelAnimation(pulse);
        pulse.value = withTiming(1);
      }
    },
    [idx, queue, pulse, reproduceFrase]
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
    pulse.value = withRepeat(withTiming(1.08, { duration: 900 }), -1, true);
    void loop(pasoIdxRef.current);
  }, [loop, pulse, detener]);

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
          emoji="🎧"
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
    <Screen edges={['top', 'bottom']}>
      <Header
        onBack={() => nav.goBack()}
        title="Modo oído"
        subtitle={`${idx + 1} de ${queue.length}`}
      />

      <View style={styles.body}>
        <Animated.View style={anim}>
          <Card style={styles.card}>
            <Text style={styles.repeticion}>Repetición {ronda}/3</Text>
            <Text style={[styles.phrase, sonandoEn && styles.sonando]}>
              {actual?.phrase ?? ''}
            </Text>
            <Text style={[styles.spanish, sonandoEs && styles.sonando]}>
              {actual?.spanish_main ?? ''}
            </Text>
          </Card>
        </Animated.View>

        <Text style={styles.hint}>
          Guarda el teléfono. Cada frase suena en inglés y en español,
          tres veces, para que la repitas en voz alta.
        </Text>
      </View>

      <Button
        label={playing ? 'Pausar' : 'Reproducir'}
        onPress={alternar}
        size="lg"
        full
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.xl },
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
    fontSize: font.size.sm,
    color: color.textFaint,
    textAlign: 'center',
    lineHeight: font.size.sm * 1.6,
    paddingHorizontal: space.lg,
  },
});
