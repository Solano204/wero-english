import { useCallback, useMemo } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getPackEntries } from '@/data/repos/frases';
import { useCarga } from '@/shared/hooks/useCarga';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Rt = RouteProp<RootStackParams, 'PackDetail'>;

/**
 * El detalle de un pack: sus frases y su estado.
 */
export function useDetallePack() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const filter = useSettingsStore((s) => s.filter);
  const content = useMemo(loadContent, []);

  const carga = useCarga(() => getPackEntries(params.packId, filter()), [params.packId, filter], {
    alEnfocar: true,
  });

  const pack = content.packs.packs.find((p) => p.id === params.packId);

  const abrir = useCallback(
    (e: Entry) => nav.navigate('Detail', { entryId: e.id }),
    [nav]
  );

  return { nav, params, carga, pack, abrir };
}
