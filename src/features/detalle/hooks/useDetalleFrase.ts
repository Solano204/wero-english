import { useCallback, useEffect, useRef, useState } from 'react';
import { loadContent } from '@/data/contenido';
import { AccessibilityInfo } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEntry } from '@/data/repos/frases';
import { isFavorite, toggleFavorite } from '@/data/repos/tarjetas';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useAuthStore } from '@/estado/useAuthStore';
import { motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Rt = RouteProp<RootStackParams, 'Detail'>;

/** De qué tamaño llega la ficha: crece hasta 1 mientras aparece. */
const ESCALA_LLEGADA = 0.96;

/**
 * El detalle de una frase: la entrada, su estado SM-2, guardar y la voz.
 */
export function useDetalleFrase() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const { top } = useSafeAreaInsets();
  useCortarAudioAlSalir();
  const scrollY = useSharedValue(0);

  const carga = useCarga(() => getEntry(params.entryId), [params.entryId], {
    esVacio: (e) => e === null,
  });
  const entry = carga.datos;
  const [fav, setFav] = useState(false);
  // Sube cada vez que la frase pasa a guardada (la fiesta); quitarla no lo sube.
  const [pulso, setPulso] = useState(0);
  // Si el usuario ya tocó el botón, la lectura inicial de la base no lo pisa.
  const tocado = useRef(false);

  // La llegada: fundido y escala de 0.96 a 1 en `escena`. Con reducir movimiento, ya está.
  const reducido = useMovimientoReducido();
  const entrada = useSharedValue(reducido ? 1 : 0);
  useEffect(() => {
    entrada.set(reducido ? 1 : withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar }));
  }, [reducido, entrada]);
  const entradaAnim = useAnimatedStyle(() => ({
    opacity: entrada.get(),
    transform: [{ scale: ESCALA_LLEGADA + (1 - ESCALA_LLEGADA) * entrada.get() }],
  }));

  // El estado real: antes el botón arrancaba siempre en «Guardar», aunque la frase ya estuviera guardada.
  useEffect(() => {
    if (!user) return;
    let vigente = true;
    void isFavorite(user.id, params.entryId).then((guardada) => {
      if (vigente && !tocado.current) setFav(guardada);
    });
    return () => {
      vigente = false;
    };
  }, [user, params.entryId]);

  const alternar = useCallback(async () => {
    if (!user || !entry) return;
    tocado.current = true;
    const guardada = await toggleFavorite(user.id, entry.id);
    setFav(guardada);
    if (guardada) setPulso((n) => n + 1);
    AccessibilityInfo.announceForAccessibility(guardada ? 'Guardada en Mi mazo' : 'Quitada de Mi mazo');
  }, [user, entry]);

  // Los mundos del catálogo se leen cuando la pantalla los pide (loadContent es perezoso por archivo).
  const mundosCatalogo = useCallback(() => loadContent().packs.mundos, []);

  return { nav, top, scrollY, carga, entry, fav, pulso, entradaAnim, alternar, mundosCatalogo };
}
