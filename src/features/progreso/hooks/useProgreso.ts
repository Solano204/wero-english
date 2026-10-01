import { useState } from 'react';
import { loadContent } from '@/data/contenido';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVisto } from '@/shared/hooks/useVisibilidad';
import { ventana, type ProgresoMundo } from '@/features/progreso/logic/datos';
import { getGameRecords } from '@/data/repos/partidas';
import { resumenTodos } from '@/data/repos/niveles';
import { getProgresoPorMundo, getStats } from '@/data/repos/estadisticas';
import type { Stats } from '@/types';
import { getRecentDays } from '@/data/repos/progreso';
import type { Niveles } from '@/domain/resumenNiveles';
import type { JuegoRecord } from '@/types';
import { useCarga } from '@/shared/hooks/useCarga';
import { useEntradaPantalla } from '@/shared/hooks/useEntradaPantalla';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { dayKey } from '@/domain/fechas';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

interface Datos {
  stats: Stats | null;
  dias: { dia: string; respuestas: number; aciertos: number }[];
  mundos: Record<string, ProgresoMundo>;
  niveles: Record<string, Niveles>;
  records: Record<string, JuegoRecord>;
}

const SIN_DATOS: Datos = { stats: null, dias: [], mundos: {}, niveles: {}, records: {} };

/**
 * Progreso: estadísticas, mundos, juegos y la gráfica de días.
 */
export function useProgreso() {
  const nav = useNavigation<Nav>();
  const { top } = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const scrollY = useSharedValue(0);
  const { primera, estiloFundido } = useEntradaPantalla('progreso');
  const [pulsos, setPulsos] = useState(0);
  const filter = useSettingsStore((s) => s.filter);

  const carga = useCarga(
    async (): Promise<Datos> => {
      if (!user) return SIN_DATOS;
      const [stats, dias, mundos, niveles, records] = await Promise.all([
        getStats(user.id),
        getRecentDays(user.id, 21),
        getProgresoPorMundo(user.id, filter()),
        resumenTodos(user.id),
        getGameRecords(user.id),
      ]);
      return { stats, dias, mundos, niveles, records };
    },
    [user, filter],
    { alEnfocar: true }
  );

  // Jalar para refrescar: recarga sin esqueleto y la aguja da un empujón al terminar.
  const { refrescar: recargar } = carga;
  const refrescar = async () => {
    await recargar();
    setPulsos((n) => n + 1);
  };

  const diasCargados = carga.datos?.dias;
  const registrados = (diasCargados ?? []);
  const dias = ventana(registrados, dayKey());
  // Sin días registrados, o ninguno dentro de las últimas tres semanas: nada de gráfica en ceros.
  const sinDias = registrados.length === 0 || dias.every((d) => d.respuestas === 0);
  const espectro = useVisto(scrollY);
  const seccionMundos = useVisto(scrollY);
  const seccionJuegos = useVisto(scrollY);
  const seccionDetalle = useVisto(scrollY);

  // Los mundos del catálogo se leen cuando la pantalla los pide (loadContent es perezoso por archivo).
  const mundosCatalogo = () => loadContent().packs.mundos;

  return { nav, top, user, scrollY, primera, estiloFundido, pulsos, carga, refrescar, dias, sinDias, espectro, seccionMundos, seccionJuegos, seccionDetalle, mundosCatalogo };
}
