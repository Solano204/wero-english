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

const SIN_ENTRADAS: Entry[] = [];

/**
 * Las entradas de todos los grupos, de una sola consulta y guardadas para toda la sesión: son 75 frases fijas del
 * catálogo. Cambiar de pestaña o volver a la pantalla ya no consulta la base ni espera nada.
 */
let porGrupoCache: Map<string, Entry[]> | null = null;

async function entradasPorGrupo(grupos: readonly { id: string; entradas: number[] }[]): Promise<Map<string, Entry[]>> {
  if (porGrupoCache) return porGrupoCache;
  const todas = await getEntriesByIds([...new Set(grupos.flatMap((g) => g.entradas))]);
  const porId = new Map(todas.map((e) => [e.id, e]));
  const mapa = new Map(
    grupos.map((g) => [g.id, g.entradas.map((id) => porId.get(id)).filter((e): e is Entry => Boolean(e))])
  );
  porGrupoCache = mapa;
  return mapa;
}

/**
 * Contracciones: la lista y su voz.
 */
export function useContracciones() {
  const nav = useNavigation<Nav>();
  const content = useMemo(() => loadContent(), []);
  useCortarAudioAlSalir();
  // Memoizado: con un array nuevo en cada render, el efecto de carga se
  // volvía a disparar en cada render y no paraba nunca.
  const grupos = useMemo(
    () => [...content.contracciones.grupos].sort((a, b) => a.orden - b.orden),
    [content]
  );

  const [activo, setActivo] = useState<string>(grupos[0]?.id ?? '');
  // Una sola carga para todos los grupos: la pestaña solo elige cuál se muestra.
  const carga = useCarga(() => entradasPorGrupo(grupos), [grupos]);
  const entries = carga.datos?.get(activo) ?? SIN_ENTRADAS;
  const cargando = carga.estado === 'cargando';

  return { nav, content, grupos, activo, setActivo, carga, entries, cargando };
}
