import { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type LecturaFila } from '@/features/lecturas/components/TarjetaLectura';
import { dificultadPara, estadoDesbloqueo } from '@/domain/lectura';
import { getCardStates } from '@/data/repos/tarjetas';
import { getDominadasPorMundo } from '@/data/repos/estadisticas';
import { getEntriesByIds } from '@/data/repos/frases';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useAuthStore } from '@/estado/useAuthStore';
import { loadContent } from '@/data/contenido';
import type { CardState, Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Lecturas: los capítulos y su avance.
 */
export function useLecturas() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const content = useMemo(loadContent, []);
  const carga = useCarga(
    async (): Promise<LecturaFila[]> => {
      if (!user) return [];
      const lecturas = content.lecturas.lecturas;
      const ids = [...new Set(lecturas.flatMap((l) => l.frases))];
      const entradas = await getEntriesByIds(ids);
      const estados = await getCardStates(user.id, ids);
      const porMundo = await getDominadasPorMundo(user.id);

      const mapaEntradas = new Map<number, Entry>(entradas.map((e) => [e.id, e]));
      const mapaEstados = new Map<number, CardState>(estados);

      return lecturas.map((l) => {
        const est = dificultadPara(l, mapaEntradas, mapaEstados);
        const bloq = estadoDesbloqueo(l, porMundo);
        return {
          lectura: l,
          dificultad: est.dificultad,
          dominadas: est.dominadas,
          total: est.total,
          abierta: bloq.abierta,
          faltan: bloq.faltan,
        };
      });
    },
    [user, content],
    { alEnfocar: true, esVacio: (f) => f.length === 0 }
  );

  // Red de seguridad: ningún audio de lectura sobrevive a salir de aquí.
  useCortarAudioAlSalir();

  const abrir = useCallback((lecturaId: string) => nav.navigate('Lectura', { lecturaId }), [nav]);

  return { nav, carga, abrir };
}
