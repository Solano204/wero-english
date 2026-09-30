import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getEntriesByIds } from '@/data/repos/frases';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { loadContent } from '@/data/contenido';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Contracciones: la lista y su voz.
 */
export function useContracciones() {
  const nav = useNavigation<Nav>();
  const content = useMemo(loadContent, []);
  useCortarAudioAlSalir();
  // Memoizado: con un array nuevo en cada render, el efecto de carga se
  // volvía a disparar en cada render y no paraba nunca.
  const grupos = useMemo(
    () => [...content.contracciones.grupos].sort((a, b) => a.orden - b.orden),
    [content]
  );

  const [activo, setActivo] = useState<string>(grupos[0]?.id ?? '');
  const carga = useCarga(
    async (): Promise<Entry[]> => {
      const g = grupos.find((x) => x.id === activo);
      return g ? getEntriesByIds(g.entradas) : [];
    },
    [activo, grupos]
  );
  const entries = carga.datos ?? [];
  // El giro de carga sale de inmediato, sin el retraso del esqueleto: es lo que ya se veía.
  const cargando = carga.estado === 'cargando';

  return { nav, content, grupos, activo, setActivo, carga, entries, cargando };
}
