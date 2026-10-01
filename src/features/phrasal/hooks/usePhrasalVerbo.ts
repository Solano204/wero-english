import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { type Viaje } from '@/features/phrasal/components/ViajeVerbo';
import { etiquetasParticulas } from '@/domain/phrasal';
import { limitarIndice } from '@/domain/ruleta';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as haptics from '@/services/haptics';
import { loadContent } from '@/data/contenido';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { layout } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { RootStackParams } from '@/types/rutas';
import type { PhrasalVerb } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParams>;

type R = RouteProp<RootStackParams, 'PhrasalVerbo'>;

/** Si el verbo no llega a su título en este tiempo (ms), se muestra igual: el vuelo nunca deja la página sin título. */
const VIAJE_MAX_MS = 1350;

/** Un deslizamiento de lado cambia de forma si recorre al menos esto (dp) o va a esta velocidad (dp/s). */
const DESLIZA_MIN = layout.tapMin;

const DESLIZA_VELOCIDAD = 600;

/** La forma que se ve y cómo se llegó a ella: hacia dónde y en qué eje se desplaza el contenido al cambiar. */
interface Cambio {
  indice: number;
  direccion: 1 | -1;
  eje: 'x' | 'y';
}

/**
 * Un phrasal verb: sus usos y su avance.
 */
export function usePhrasalVerbo() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<R>();
  const reducido = useMovimientoReducido();
  const content = useMemo(() => loadContent(), []);
  useCortarAudioAlSalir();
  const modoLimpio = useSettingsStore((s) => s.modoLimpio);
  const verboRef = useRef<View>(null);
  const [cambio, setCambio] = useState<Cambio>({ indice: 0, direccion: 1, eje: 'y' });
  const [viaje, setViaje] = useState<Viaje | null>(() =>
    params.origen ? { verbo: params.verbo, desde: params.origen, hasta: null } : null
  );
  const volando = viaje !== null;

  // Las formas del verbo, con el mismo filtro que la lista: el modo limpio esconde las fuertes.
  const formas = useMemo(() => {
    const grupo = content.phrasal.grupos.find((g) => g.verbo === params.verbo);
    if (!grupo) return [];
    const porId = new Map<number, PhrasalVerb>(content.phrasal.verbos.map((v) => [v.id, v]));
    return grupo.ids
      .map((id) => porId.get(id))
      .filter((v): v is PhrasalVerb => v !== undefined && !(modoLimpio && v.vulgaridad === 2));
  }, [content, params.verbo, modoLimpio]);
  const etiquetas = etiquetasParticulas(formas.map((f) => f.particula));
  const n = formas.length;

  const medirVerbo = () => {
    verboRef.current?.measureInWindow((x, y, width, height) =>
      setViaje((v) => (v && !v.hasta ? { ...v, hasta: { x, y, width, height } } : v))
    );
  };
  const finViaje = () => setViaje(null);
  const elegir = useCallback(
    (indice: number, eje: 'x' | 'y') =>
      setCambio((c) => (indice === c.indice ? c : { indice, direccion: indice > c.indice ? 1 : -1, eje })),
    []
  );
  const elegirConRuleta = (indice: number) => elegir(indice, 'y');
  const elegirConChips = (indice: number) => elegir(indice, 'x');

  /** Pasa a la forma anterior o a la siguiente (deslizar la tarjeta de lado). */
  const pasar = useCallback(
    (delta: 1 | -1) => {
      const indice = limitarIndice(cambio.indice + delta, n);
      if (indice === cambio.indice) return;
      haptics.selection();
      elegir(indice, 'x');
    },
    [cambio.indice, n, elegir]
  );
  const deslizar = useMemo(
    () =>
      Gesture.Pan()
        .enabled(n > 1)
        .activeOffsetX([-20, 20])
        .failOffsetY([-16, 16])
        .onEnd((e, exito) => {
          if (!exito) return;
          if (Math.abs(e.translationX) < DESLIZA_MIN && Math.abs(e.velocityX) < DESLIZA_VELOCIDAD) return;
          runOnJS(pasar)(e.translationX < 0 ? 1 : -1);
        }),
    [n, pasar]
  );

  useEffect(() => {
    if (!volando) return;
    const t = setTimeout(() => setViaje(null), VIAJE_MAX_MS);
    return () => clearTimeout(t);
  }, [volando]);

  const forma = formas[cambio.indice];

  return { nav, params, reducido, verboRef, cambio, viaje, volando, etiquetas, n, medirVerbo, finViaje, elegirConRuleta, elegirConChips, deslizar, forma };
}
