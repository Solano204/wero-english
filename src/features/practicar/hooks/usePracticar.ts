import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getGameRecords, getHablaResumen, getRetoSemanal, getUsoModos } from '@/data/repos/partidas';
import { resumenTodos } from '@/data/repos/niveles';
import { getRecentDays } from '@/data/repos/progreso';
import { countDue, countNew } from '@/data/repos/tarjetas';
import { getStats } from '@/data/repos/estadisticas';
import { filtroEstudio } from '@/domain/cola';
import { useCarga } from '@/shared/hooks/useCarga';
import { useEntradaPantalla } from '@/shared/hooks/useEntradaPantalla';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import { dayKey } from '@/domain/fechas';
import { marcarPracticarInteractivo } from '@/shared/utils/medicion';
import type { JuegoRecord, RetoSemanal } from '@/types';
import type { RootStackParams } from '@/types/rutas';
import { metaDe, textoMeta, type FuentesMeta } from '@/features/practicar/logic/metadatos';
import { elegirDestacados, elegirHoy, type ModoId, type Uso } from '@/features/practicar/logic/hoy';
import { MODOS } from '@/shared/navegacion/modos';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Resumen = Awaited<ReturnType<typeof getStats>>;

interface Datos {
  records: Record<string, JuegoRecord>;
  reto: RetoSemanal | null;
  habla: { intentos: number; dominados: number };
  niveles: Record<string, { jugados: number; estrellas: number; siguiente: number }>;
  stats: Resumen | null;
  uso: Uso;
  hoyFrases: number;
  vencidas: number;
  /** Frases nuevas que quedan en el catálogo (con el filtro): decide qué ofrece HOY sin repasos. */
  nuevas: number;
}

const SIN_DATOS: Datos = {
  records: {},
  reto: null,
  habla: { intentos: 0, dominados: 0 },
  niveles: {},
  stats: null,
  uso: {},
  hoyFrases: 0,
  vencidas: 0,
  nuevas: 0,
};

/**
 * Practicar (la pestaña de inicio): lo de HOY, los destacados, los grupos y las celebraciones.
 */
export function usePracticar() {
  const nav = useNavigation<Nav>();
  const { top } = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const { primera: primeraEntrada, estiloFundido } = useEntradaPantalla('practicar');
  const user = useAuthStore((s) => s.user);
  const abiertos = useSettingsStore((s) => s.practicarGruposAbiertos);
  const guardarAjuste = useSettingsStore((s) => s.set);
  const filter = useSettingsStore((s) => s.filter);
  const metaDiaria = useSettingsStore((s) => s.metaDiaria);

  const carga = useCarga(
    async (): Promise<Datos> => {
      if (!user) return SIN_DATOS;
      const [records, reto, habla, niveles, stats, uso, dias, vencidas, nuevas] = await Promise.all([
        getGameRecords(user.id),
        getRetoSemanal(user.id),
        getHablaResumen(user.id),
        resumenTodos(user.id),
        getStats(user.id),
        getUsoModos(user.id),
        getRecentDays(user.id, 1),
        countDue(user.id, filtroEstudio(filter())),
        countNew(user.id, filtroEstudio(filter())),
      ]);
      const hoyFrases = dias[0]?.dia === dayKey() ? dias[0].respuestas : 0;
      return { records, reto, habla, niveles, stats, uso, hoyFrases, vencidas, nuevas };
    },
    [user, filter],
    { alEnfocar: true }
  );
  // Hasta que carga, HOY se maqueta pero no se ve ni se toca: si no, pintaría
  // el caso "usuario nuevo" un instante y luego saltaría a otro.
  const listo = carga.estado === 'listo';
  // Medición del arranque (docs/RENDIMIENTO.md): el primer cuadro con los datos ya pintados.
  useEffect(() => {
    if (!listo) return undefined;
    const id = requestAnimationFrame(marcarPracticarInteractivo);
    return () => cancelAnimationFrame(id);
  }, [listo]);

  // Jalar para refrescar: recarga sin esqueleto y la onda de HOY da un pulso al terminar.
  const [refrescos, setRefrescos] = useState(0);
  const refrescar = useCallback(async () => {
    await carga.refrescar();
    setRefrescos((n) => n + 1);
  }, [carga.refrescar]);
  const { records, reto, habla, niveles, stats, uso, hoyFrases, vencidas, nuevas } = carga.datos ?? SIN_DATOS;

  const atoradas = stats?.atoradas ?? 0;
  const racha = stats?.racha ?? 0;
  const hoy = elegirHoy(vencidas, atoradas, uso);
  const destacados = elegirDestacados(uso, hoy.modo);
  const modoHoy = MODOS[hoy.modo];

  const fuentesMeta: FuentesMeta = {
    niveles,
    records,
    paresLimpios: habla.dominados,
    atoradas,
    guardadas: stats?.favoritas ?? 0,
    frasesPhrasal: loadContent().phrasal.verbos.length,
  };
  /** El dato de un modo como línea de texto (la de una tarjeta destacada sin niveles). */
  const datoDe = (id: ModoId): string | null => textoMeta(metaDe(id, fuentesMeta));

  const alternar = (grupo: string) => {
    if (!user) return;
    const siguiente = abiertos.includes(grupo)
      ? abiertos.filter((g) => g !== grupo)
      : [...abiertos, grupo];
    void guardarAjuste(user.id, 'practicarGruposAbiertos', siguiente);
  };

  return { nav, top, scrollY, primeraEntrada, estiloFundido, user, abiertos, metaDiaria, carga, listo, refrescos, refrescar, reto, niveles, hoyFrases, vencidas, nuevas, atoradas, racha, hoy, destacados, modoHoy, fuentesMeta, datoDe, alternar };
}
