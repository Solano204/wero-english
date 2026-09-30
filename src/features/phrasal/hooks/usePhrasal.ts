import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Rect } from '@/shared/ui/fx/useDesfaseVentana';
import { type FormaRenglon } from '@/features/phrasal/components/RenglonVerbo';
import { buscarGrupos, etiquetasParticulas } from '@/domain/phrasal';
import { loadContent } from '@/data/contenido';
import { useSettingsStore } from '@/estado/useSettingsStore';
import type { RootStackParams } from '@/types/rutas';
import type { PhrasalVerb } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParams>;

export interface ItemVerbo {
  verbo: string;
  formas: FormaRenglon[];
  coinciden: number[];
}

/**
 * Phrasal verbs: la lista y su avance.
 */
export function usePhrasal() {
  const nav = useNavigation<Nav>();
  const content = useMemo(() => loadContent(), []);
  const modoLimpio = useSettingsStore((s) => s.modoLimpio);
  const [consulta, setConsulta] = useState('');

  const { grupos, porId } = useMemo(() => {
    const mapa = new Map<number, PhrasalVerb>(
      content.phrasal.verbos.map((v) => [v.id, v])
    );
    // El modo limpio esconde los fuertes aquí igual que en el catálogo.
    // Si un verbo se queda sin ninguno, el grupo desaparece entero en
    // vez de mostrarse vacío.
    const gs = content.phrasal.grupos
      .map((g) => ({
        ...g,
        ids: g.ids.filter((id) => {
          const v = mapa.get(id);
          return v ? !(modoLimpio && v.vulgaridad === 2) : false;
        }),
      }))
      .filter((g) => g.ids.length > 0);
    return { grupos: gs, porId: mapa };
  }, [content, modoLimpio]);

  const items = useMemo<ItemVerbo[]>(
    () =>
      buscarGrupos(grupos, porId, consulta).map((g) => {
        const etiquetas = etiquetasParticulas(g.ids.map((id) => porId.get(id)?.particula ?? ''));
        return {
          verbo: g.verbo,
          coinciden: g.coinciden,
          formas: g.ids.map((id, i) => ({ id, etiqueta: etiquetas[i] ?? '' })),
        };
      }),
    [grupos, porId, consulta]
  );

  const abrir = (verbo: string, origen: Rect | null) => nav.navigate('PhrasalVerbo', { verbo, origen });

  return { nav, content, consulta, setConsulta, grupos, items, abrir };
}
