import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { EmptyState, Header, Screen } from '@/components/base';
import { BarraSesion } from '@/components/fx';
import { BloqueEscucha } from '@/components/juegos/cazala/BloqueEscucha';
import type { ItemMorph } from '@/components/juegos/cazala/FraseMorph';
import { PieCaza } from '@/components/juegos/cazala/PieCaza';
import { RenglonCaza, type EstadoRenglon } from '@/components/juegos/cazala/RenglonCaza';
import { ResultadoCaza } from '@/components/juegos/cazala/ResultadoCaza';
import { useVozCaza } from '@/components/juegos/cazala/useVozCaza';
import { applyGameGrade } from '@/data/repos/juegos';
import { itemsCazalaValidos, reduccionesDe } from '@/domain/cazala';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/data/contenido';
import { shuffle } from '@/domain/arreglos';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { reacomodar, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Por debajo de este alto (dp) todo se aprieta: la onda va junto a los botones, filas de 48 y huecos de 4. */
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
  const [alturaHoja, setAlturaHoja] = useState(0);
  const esperaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El candado de "Siguiente" de verdad: `esperando` solo deshabilita el
  // botón, y dos toques en el mismo cuadro todavía lo ven en false.
  const candadoAvanzar = useRef(false);
  const autoAudio = useSettingsStore((s) => s.autoAudio);
  const { height: alto } = useWindowDimensions();
  const compacta = alto < ALTO_COMPACTO;
  useMusicaPantalla('juegos');
  useCortarAudioAlSalir();

  const item = items[idx];
  // Las seis opciones ya barajadas: una sola vez por ronda.
  const order = useMemo(() => (item ? shuffle(item.opciones) : []), [item]);
  const { voz, vozLenta, analisis, analisisLento, posRevision } = useVozCaza(item, checked, autoAudio);

  // Las tres reducciones en el orden en que suenan, las palabras de la frase que ocupan y el segundo en que suena cada una.
  const reducciones = useMemo(() => (item ? reduccionesDe(item, porId) : []), [item, porId]);
  const destacadas = useMemo(() => {
    const palabras = new Set<number>();
    for (const r of reducciones) {
      if (r.rango) for (let i = r.rango[0]; i <= r.rango[1]; i++) palabras.add(i);
    }
    return palabras;
  }, [reducciones]);
  const tiempos = useMemo(
    () => reducciones.map((r) => (r.rango ? (analisis?.palabras[r.rango[0]]?.inicio ?? 0) : 0)),
    [reducciones, analisis]
  );
  const morphs = useMemo<ItemMorph[]>(
    () =>
      reducciones
        .map((r, i) => ({ reducida: r.reducida, completa: r.completa, suena: r.suena, t: tiempos[i] ?? 0 }))
        .filter((m) => m.completa !== null || m.suena !== null),
    [reducciones, tiempos]
  );

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
    if (candadoAvanzar.current) return;
    candadoAvanzar.current = true;
    setEsperando(true);
    try {
      audio.stop();
      if (idx + 1 >= items.length) {
        nav.goBack();
        return;
      }
      setPicked([]);
      setChecked(false);
      setIdx((i) => i + 1);
    } finally {
      // El candado se suelta siempre, aunque el cambio de ronda fallara.
      if (esperaTimer.current) clearTimeout(esperaTimer.current);
      esperaTimer.current = setTimeout(() => {
        candadoAvanzar.current = false;
        setEsperando(false);
      }, AVANZAR_DEBOUNCE_MS);
    }
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

  // Entre el último renglón y el resumen no hay renglón: la pantalla nunca queda en blanco, sale con su encabezado.
  if (!item) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Cázala" />
      </Screen>
    );
  }

  const estadoDe = (id: number): EstadoRenglon => {
    const marcada = picked.includes(id);
    if (!checked) return marcada ? 'marcada' : 'libre';
    if (item.reducciones.includes(id)) return marcada ? 'cazada' : 'perdida';
    return marcada ? 'noIba' : 'atenuada';
  };

  const aciertos = picked.filter((p) => item.reducciones.includes(p)).length;
  const tiempoDe = (id: number) => tiempos[reducciones.findIndex((r) => r.id === id)] ?? 0;

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
          caceria={checked ? { pos: posRevision, tiempos } : null}
        />

        <Animated.View layout={reacomodar()} style={styles.lista}>
          <ScrollView
            contentContainerStyle={[
              styles.filas,
              compacta && styles.filasCompactas,
              // La hoja del resultado tapa la parte baja: la lista deja ese espacio libre para llegar a todas sus filas.
              checked && { paddingBottom: alturaHoja + space.sm },
            ]}
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
                caceria={checked && item.reducciones.includes(id) ? { pos: posRevision, t: tiempoDe(id) } : null}
                onPress={() => toggle(id)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {checked && analisis ? (
          <ResultadoCaza
            key={item.id}
            aciertos={aciertos}
            fraseReal={item.frase_real}
            fraseFormal={item.frase_formal}
            fraseEs={item.frase_es}
            audioEs={item.audio_es}
            palabras={analisis.palabras}
            destacadas={destacadas}
            voz={voz}
            morphs={morphs}
            pos={posRevision}
            alAlto={setAlturaHoja}
          />
        ) : null}
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
});
