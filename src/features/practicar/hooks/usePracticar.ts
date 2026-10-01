import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getResumenPracticar } from '@/data/repos/resumenPracticar';
import type { getStats } from '@/data/repos/estadisticas';
import { filtroEstudio } from '@/domain/cola';
import { useCarga } from '@/shared/hooks/useCarga';
import { useEntradaPantalla } from '@/shared/hooks/useEntradaPantalla';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { PHRASAL_VERBOS } from '@/data/resumenContenido';
import { dayKey } from '@/domain/fechas';
import { marcar, marcarPracticarInteractivo } from '@/shared/utils/marcasArranque';
import { listoParaDiferidos } from '@/services/trasArranque';
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
  const filter = useSettingsStore((s) => s.filter);
  const metaDiaria = useSettingsStore((s) => s.metaDiaria);

  const carga = useCarga(
    async (): Promise<Datos> => {
      if (!user) return SIN_DATOS;
      // Una sola consulta con todo lo de la pantalla (antes, 12 viajes a SQLite).
      const { records, reto, habla, niveles, stats, uso, dias, vencidas, nuevas } = await getResumenPracticar(
        user.id,
        filtroEstudio(filter())
      );
      const hoyFrases = dias[0]?.dia === dayKey() ? dias[0].respuestas : 0;
      return { records, reto, habla, niveles, stats, uso, hoyFrases, vencidas, nuevas };
    },
    [user, filter],
    { alEnfocar: true }
  );
  // Hasta que carga, HOY se maqueta pero no se ve ni se toca: si no, pintaría
  // el caso "usuario nuevo" un instante y luego saltaría a otro.
  const listo = carga.estado === 'listo';
  // Medición del arranque: el primer cuadro de Practicar, con o sin datos.
  useEffect(() => marcar('primerRender'), []);
  // El primer cuadro con los datos ya pintados: la marca del arranque (docs/RENDIMIENTO.md) y, desde ahí, lo que se
  // dejó para después (trasArranque: audio, canal de notificaciones, desbloqueos).
  useEffect(() => {
    if (!listo) return undefined;
    const id = requestAnimationFrame(() => {
      marcarPracticarInteractivo();
      listoParaDiferidos();
    });
    return () => cancelAnimationFrame(id);
  }, [listo]);

  // Jalar para refrescar: recarga sin esqueleto y la onda de HOY da un pulso al terminar.
  const [refrescos, setRefrescos] = useState(0);
  const { refrescar: recargar } = carga;
  const refrescar = async () => {
    await recargar();
    setRefrescos((n) => n + 1);
  };
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
    frasesPhrasal: PHRASAL_VERBOS,
  };
  /** El dato de un modo como línea de texto (la de una tarjeta destacada sin niveles). */
  const datoDe = (id: ModoId): string | null => textoMeta(metaDe(id, fuentesMeta));

  return { nav, top, scrollY, primeraEntrada, estiloFundido, user, metaDiaria, carga, listo, refrescos, refrescar, reto, niveles, hoyFrases, vencidas, nuevas, atoradas, racha, hoy, destacados, modoHoy, fuentesMeta, datoDe };
}
