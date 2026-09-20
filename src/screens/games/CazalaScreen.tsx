import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  Button,
  Card,
  Carga,
  EmptyState,
  Header,
  ProgressBar,
  Screen,
  SkeletonLista,
} from '@/components/base';
import { AudioButton, OptionButton, type OptionState } from '@/components/card';
import { getEntriesByIds } from '@/db/queries';
import { applyGameGrade } from '@/db/games';
import { itemsCazalaValidos } from '@/domain/cazala';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { shuffle } from '@/utils/array';
import { useCarga } from '@/hooks/useCarga';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, space, aparecerSubiendo } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * El ejercicio "Cázala": suena una frase a velocidad natural y hay que
 * decir cuáles tres reducciones venían.
 *
 * Se muestran seis opciones (tres correctas, tres distractores) y se
 * exigen exactamente tres selecciones antes de poder revisar.
 */
export function CazalaScreen() {
  const nav = useNavigation<Nav>();
  const content = useMemo(loadContent, []);
  // Un dato roto (reducción que no suena en la frase, o regla gramatical
  // que no se puede "cazar") nunca debe llegar a una ronda jugable.
  const items = useMemo(() => {
    const porId = new Map(content.catalog.entries.map((e) => [e.id, e]));
    return itemsCazalaValidos(content.contracciones.cazala, porId, (item, errores) => {
      console.warn(`[Cázala] ronda "${item.id}" descartada: ${errores.join('; ')}`);
    });
  }, [content]);

  const [idx, setIdx] = useState(0);
  const user = useAuthStore((st) => st.user);
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const autoAudio = useSettingsStore((s) => s.autoAudio);
  useMusicaPantalla('juegos');

  const item = items[idx];

  useEffect(() => {
    return () => audio.stop();
  }, []);

  useEffect(() => {
    if (!item) return;
    setPicked([]);
    setChecked(false);
    setOrder(shuffle(item.opciones));
  }, [item]);

  const carga = useCarga(
    async () => {
      const map = new Map<number, string>();
      if (!item) return map;
      for (const e of await getEntriesByIds(item.opciones)) {
        // phrase_tts trae la forma reducida y audible: "chillin'", no "chilling".
        map.set(e.id, e.phrase_tts);
      }
      return map;
    },
    [item]
  );

  const toggle = useCallback(
    (id: number) => {
      if (checked) return;
      haptics.selection();
      setPicked((p) =>
        p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p
      );
    },
    [checked]
  );

  const revisar = useCallback(() => {
    if (!item || picked.length !== 3) return;
    setChecked(true);
    const bien = picked.filter((p) => item.reducciones.includes(p)).length;
    const gano = bien === 3;
    if (gano) {
      haptics.success();
    } else {
      haptics.failure();
    }
    // Igual que Colmena y Caída: si autoAudio está prendido, la frase se
    // oye completa en inglés y luego en español, no solo en inglés.
    if (autoAudio) {
      void audio.playRoundResultBilingue(gano, item.audio, item.audio_es);
    } else {
      void audio.playRoundResult(gano, item.audio, false);
    }

    /*
     * Cázala también alimenta el progreso.
     *
     * Era el único juego que no lo hacía: se jugaba, se acertaba, y en
     * Progreso no se movía nada. Ahora cada reducción cuenta como lo que
     * es — una entrada del catálogo que reconociste de oído o no.
     *
     * Va como 'reconocer' y no como 'producir': marcarla en una lista es
     * más fácil que decirla en frío, y el motor SM-2 lo tiene que saber
     * o la frase se daría por dominada antes de tiempo.
     */
    if (user) {
      for (const id of item.reducciones) {
        void applyGameGrade(user.id, id, picked.includes(id), 0, 'reconocer');
      }
    }
  }, [item, picked, user, autoAudio]);

  const siguiente = useCallback(() => {
    audio.stop();
    if (idx + 1 >= items.length) {
      nav.goBack();
      return;
    }
    setIdx((i) => i + 1);
  }, [idx, items.length, nav]);

  if (items.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Cázala" />
        <EmptyState
          icon="warning"
          title="Falta el contenido"
          body="Pega contracciones.json en assets/data y recarga la app."
        />
      </Screen>
    );
  }

  if (!item) return null;

  const stateFor = (id: number): OptionState => {
    if (!checked) return picked.includes(id) ? 'chosen' : 'idle';
    if (item.reducciones.includes(id)) return 'correct';
    if (picked.includes(id)) return 'wrong';
    return 'dimmed';
  };

  const aciertos = picked.filter((p) => item.reducciones.includes(p)).length;

  return (
    <Screen scroll>
      <Header
        onBack={() => nav.goBack()}
        title="Cázala"
        subtitle={`${idx + 1} de ${items.length}`}
      />
      <ProgressBar value={idx} total={items.length} />

      <Card style={styles.player}>
        <Text style={styles.instruction}>
          Escucha y marca las TRES reducciones que oíste
        </Text>
        <View style={styles.audioRow}>
          <AudioButton path={item.audio} size="lg" label="Escuchar" />
          <AudioButton path={item.audio_lento} size="md" slow label="Lento" />
        </View>
      </Card>

      <View style={styles.options}>
        <Carga carga={carga} esqueleto={<SkeletonLista filas={6} alto={56} />}>
          {(labels) =>
            order.map((id, i) => (
              <OptionButton
                key={id}
                index={i}
                label={labels.get(id) ?? `#${id}`}
                state={stateFor(id)}
                disabled={checked}
                onPress={() => toggle(id)}
              />
            ))
          }
        </Carga>
      </View>

      {checked ? (
        <Animated.View entering={aparecerSubiendo()} style={styles.result}>
          <Text style={styles.resultHead}>
            {aciertos === 3 ? 'Las tres' : `${aciertos} de 3`}
          </Text>
          <Text style={styles.real}>{item.frase_real}</Text>
          <Text style={styles.formal}>{item.frase_formal}</Text>
          <View style={styles.spanishRow}>
            <Text style={styles.spanish}>{item.frase_es}</Text>
            <AudioButton path={item.audio_es} size="sm" />
          </View>
          <Button
            icon="arrow-right"
            accessibilityLabel="Siguiente"
            onPress={siguiente}
            full
          />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn} style={styles.footer}>
          <Text style={styles.picked}>{picked.length} de 3 marcadas</Text>
          <Button
            label="Revisar"
            onPress={revisar}
            disabled={picked.length !== 3}
            full
          />
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  player: {
    marginTop: space.lg,
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xl,
  },
  instruction: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.textMuted,
    textAlign: 'center',
  },
  audioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  options: { gap: space.md, marginTop: space.lg },
  footer: { marginTop: space.lg, gap: space.sm, alignItems: 'center' },
  picked: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  result: { marginTop: space.lg, gap: space.sm },
  resultHead: {
    fontSize: font.size.sm,
    fontFamily: font.family.bodyStrong,
    color: color.correct,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  real: {
    fontSize: font.size.lg,
    color: color.text,
    fontFamily: font.family.heading,
  },
  formal: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  spanishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  spanish: { flex: 1, fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
});
