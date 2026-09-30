import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { contentHealth } from '@/data/contenido';
import { countEntries } from '@/data/semilla/sembrar';
import { getDiagnosticoCola } from '@/data/repos/tarjetas';
import { filtroEstudio } from '@/domain/cola';
import { useCarga } from '@/shared/hooks/useCarga';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import * as downloads from '@/services/descargas';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Diagnóstico: lo que la app sabe del teléfono y la base.
 */
export function useDiagnostico() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const health = contentHealth();

  const carga = useCarga(
    async () => {
      const [enDb, cola] = await Promise.all([
        countEntries(),
        user ? getDiagnosticoCola(user.id, filtroEstudio(filter())) : null,
      ]);
      return { enDb, cola, mb: downloads.mediaSize() / 1_048_576 };
    },
    [user, filter]
  );

  return { nav, health, carga };
}
