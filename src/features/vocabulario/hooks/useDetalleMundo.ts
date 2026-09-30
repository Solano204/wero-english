import { useMemo } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getPackCounts } from '@/data/repos/estadisticas';
import { useCarga } from '@/shared/hooks/useCarga';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import { color } from '@/theme';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Rt = RouteProp<RootStackParams, 'WorldDetail'>;

/**
 * El detalle de un mundo: sus packs y su avance.
 */
export function useDetalleMundo() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const content = useMemo(() => loadContent(), []);

  const carga = useCarga(
    async (): Promise<Record<string, { total: number; vistas: number; dominadas: number }>> =>
      user ? getPackCounts(user.id, filter()) : {},
    [user, filter],
    { alEnfocar: true }
  );

  const mundo = content.packs.mundos.find((m) => m.id === params.worldId);
  const packs = content.packs.packs
    .filter((p) => p.mundo === params.worldId)
    .sort((a, b) => a.orden - b.orden);

  const tint =
    color.world[params.worldId as keyof typeof color.world] ?? color.accent;

  return { nav, params, carga, mundo, packs, tint };
}
