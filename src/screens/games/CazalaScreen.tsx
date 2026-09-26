import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { EmptyState, Header, Screen } from '@/components/base';
import { AudioButton } from '@/components/card';
import { BarraSesion } from '@/components/fx';
import { BloqueEscucha } from '@/components/juegos/cazala/BloqueEscucha';
import { PieCaza } from '@/components/juegos/cazala/PieCaza';
import { RenglonCaza, type EstadoRenglon } from '@/components/juegos/cazala/RenglonCaza';
import { useVozCaza } from '@/components/juegos/cazala/useVozCaza';
import { applyGameGrade } from '@/db/games';
import { itemsCazalaValidos } from '@/domain/cazala';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { shuffle } from '@/utils/array';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, reacomodar, space, aparecerSubiendo } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Por debajo de este alto (dp) todo se aprieta: la onda va junto a los botones, filas de 52 y huecos de 4. */
const ALTO_COMPACTO = 700;
/** Cuánto se bloquea «Siguiente» tras tocarlo, para no procesar dos toques. */
const AVANZAR_DEBOUNCE_MS = 400;
/** Cuántas reducciones hay que marcar para poder revisar. */
const MARCAS = 3;

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
  const porId = useMemo(() => new Map(content.catalog.entries.map((e) => [e.id, e])), [content]);
  // Un dato roto (reducción que no suena en la frase, o regla gramatical
  // que no se puede "cazar") nunca debe llegar a una ronda jugable.
  const items = useMemo(
    () =>
      itemsCazalaValidos(content.contracciones.cazala, porId, (item, errores) => {
        console.warn(`[Cázala] ronda "${item.id}" descartada: ${errores.join('; ')}`);
      }),
    [content, porId]
  );

  const [idx, setIdx] = useState(0);
  const user = useAuthStore((st) => st.user);
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const esperaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAudio = useSettingsStore((s) => s.autoAudio);
  const { height: alto } = useWindowDimensions();
  const compacta = alto < ALTO_COMPACTO;
  useMusicaPantalla('juegos');

  const item = items[idx];
  // Las seis opciones ya barajadas: una sola vez por ronda.
  const order = useMemo(() => (item ? shuffle(item.opciones) : []), [item]);
  const { voz, vozLenta, analisis, analisisLento } = useVozCaza(item);

  useEffect(() => {
    // Al salir de la pantalla o ir a segundo plano se corta la voz.
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') audio.stop();
    });
    return () => {
      sub.remove();
      audio.stop();
      if (esperaTimer.current) clearTimeout(esperaTimer.current);
    };
  }, []);

  const toggle = useCallback(
    (id: number) => {
      if (checked) return;
      const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < MARCAS ? [...picked, id] : picked;
      if (next === picked) return;
      haptics.selection();
      setPicked(next);
      AccessibilityInfo.announceForAccessibility(`${next.length} de ${MARCAS} marcadas`);
    },
    [checked, picked]
  );

  const revisar = useCallback(() => {
    if (!item || picked.length !== MARCAS) return;
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
    if (esperando) return;
    setEsperando(true);
    if (esperaTimer.current) clearTimeout(esperaTimer.current);
    esperaTimer.current = setTimeout(() => setEsperando(false), AVANZAR_DEBOUNCE_MS);
    audio.stop();
    if (idx + 1 >= items.length) {
      nav.goBack();
      return;
    }
    setPicked([]);
    setChecked(false);
    setIdx((i) => i + 1);
  }, [esperando, idx, items.length, nav]);

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

  const estadoDe = (id: number): EstadoRenglon => {
    const marcada = picked.includes(id);
    if (!checked) return marcada ? 'marcada' : 'libre';
    if (item.reducciones.includes(id)) return marcada ? 'cazada' : 'perdida';
    return marcada ? 'noIba' : 'atenuada';
  };

  const aciertos = picked.filter((p) => item.reducciones.includes(p)).length;

  return (
    <Screen
      padded={false}
      footer={
        <PieCaza
          marcadas={picked.length}
          revisada={checked}
          ultima={idx + 1 >= items.length}
          compacta={compacta}
          esperando={esperando}
          onRevisar={revisar}
          onSiguiente={siguiente}
        />
      }
    >
      <View style={styles.cabeza}>
        <Header onBack={() => nav.goBack()} title="Cázala" subtitle={`${idx + 1} de ${items.length}`} />
        <View style={styles.barra}>
          <BarraSesion hecho={idx + (checked ? 1 : 0)} meta={items.length} />
        </View>
      </View>

      <View style={[styles.cuerpo, compacta && styles.cuerpoCompacto]}>
        <BloqueEscucha
          audio={item.audio}
          audioLento={item.audio_lento}
          voz={voz}
          vozLenta={vozLenta}
          envolvente={analisis?.envolvente ?? []}
          envolventeLenta={analisisLento?.envolvente ?? []}
          compacta={compacta}
          conInstruccion={!checked}
        />

        <Animated.View layout={reacomodar()} style={styles.lista}>
          <ScrollView
            contentContainerStyle={[styles.filas, compacta && styles.filasCompactas]}
            showsVerticalScrollIndicator={false}
          >
            {order.map((id, i) => (
              <RenglonCaza
                key={`${item.id}-${id}`}
                indice={i}
                compacta={compacta}
                label={porId.get(id)?.phrase_tts ?? `#${id}`}
                estado={estadoDe(id)}
                bajada={picked.length === MARCAS && !picked.includes(id)}
                caceria={null}
                onPress={() => toggle(id)}
              />
            ))}
            {checked ? (
              <Animated.View entering={aparecerSubiendo()} style={styles.result}>
                <Text style={styles.resultHead}>{aciertos === 3 ? 'Las tres' : `${aciertos} de 3`}</Text>
                <Text style={styles.real}>{item.frase_real}</Text>
                <Text style={styles.formal}>{item.frase_formal}</Text>
                <View style={styles.spanishRow}>
                  <Text style={styles.spanish}>{item.frase_es}</Text>
                  <AudioButton path={item.audio_es} size="sm" />
                </View>
              </Animated.View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabeza: { paddingHorizontal: space.lg, paddingTop: space.sm },
  // El halo de la barra ocupa 24 dp; se le devuelve lo que sobra para que no separe la tarjeta.
  barra: { marginTop: -space.sm, marginBottom: -space.sm },
  cuerpo: { flex: 1, paddingHorizontal: space.lg, gap: space.md },
  cuerpoCompacto: { gap: space.sm },
  // La lista sale 8 dp a cada lado y sus filas entran 8: las esquinas del retículo asoman fuera del renglón sin recortarse.
  lista: { flex: 1, marginHorizontal: -space.sm },
  filas: { gap: space.sm, paddingHorizontal: space.sm, paddingTop: space.xs, paddingBottom: space.sm },
  filasCompactas: { gap: space.xs },
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
