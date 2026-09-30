import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { RONDA_INICIAL, alternarMarca, rondaCazala } from '../logic/ronda';
import { AccessibilityInfo, AppState, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ItemMorph } from '@/features/juegos/cazala/components/FraseMorph';
import { useVozCaza } from '@/features/juegos/cazala/hooks/useVozCaza';
import { applyGameGrade } from '@/data/repos/juegos';
import { itemsCazalaValidos, reduccionesDe } from '@/domain/cazala';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import { shuffle } from '@/domain/arreglos';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Por debajo de este alto (dp) todo se aprieta: la onda va junto a los botones, filas de 48 y huecos de 4. */
const ALTO_COMPACTO = 700;

/** Cuánto se bloquea «Siguiente» tras tocarlo, para no procesar dos toques. */
const AVANZAR_DEBOUNCE_MS = 400;

/** Cuántas reducciones hay que marcar para poder revisar. */
export const MARCAS = 3;

/**
 * Una ronda de Cázala: la frase, las seis opciones, las marcas, la revisión y el paso a la siguiente.
 * La pantalla solo la pinta.
 */
export function useRondaCazala() {
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
  // marcando o revisada, con las reducciones marcadas (ver logic/ronda.ts).
  const [ronda, despachar] = useReducer(rondaCazala, RONDA_INICIAL);
  const picked = ronda.marcadas;
  const checked = ronda.fase === 'revisada';
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
      const next = alternarMarca(picked, id, MARCAS);
      if (next === picked) return;
      haptics.selection();
      despachar({ tipo: 'marcar', marcadas: next });
      AccessibilityInfo.announceForAccessibility(`${next.length} de ${MARCAS} marcadas`);
    },
    [checked, picked]
  );

  const revisar = useCallback(() => {
    if (!item || picked.length !== MARCAS) return;
    despachar({ tipo: 'revisar', marcas: MARCAS });
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
      despachar({ tipo: 'nuevaRonda' });
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

  return { nav, porId, items, idx, picked, checked, esperando, alturaHoja, setAlturaHoja, compacta, item, order, voz, vozLenta, analisis, analisisLento, posRevision, reducciones, destacadas, tiempos, morphs, toggle, revisar, siguiente };
}
