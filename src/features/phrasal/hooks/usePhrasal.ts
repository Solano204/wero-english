import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Rect } from '@/shared/ui/fx/useDesfaseVentana';
import { type FormaRenglon } from '@/features/phrasal/components/RenglonVerbo';
import { buscarGrupos, etiquetasParticulas, pajaresDe } from '@/domain/phrasal';
import { loadContent } from '@/data/contenido';
import { useSettingsStore } from '@/estado/useSettingsStore';
import type { RootStackParams } from '@/types/rutas';
import type { PhrasalVerb } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParams>;

const SIN_COINCIDENCIAS: number[] = [];

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

  // Lo que no depende de la búsqueda se arma una vez por lista: las formas de cada verbo (el mismo arreglo en
  // cada tecla, así el renglón memo no se repinta por él) y el texto normalizado donde se busca.
  const formasPorVerbo = useMemo(() => {
    const out = new Map<string, FormaRenglon[]>();
    for (const g of grupos) {
      const etiquetas = etiquetasParticulas(g.ids.map((id) => porId.get(id)?.particula ?? ''));
      out.set(g.verbo, g.ids.map((id, i) => ({ id, etiqueta: etiquetas[i] ?? '' })));
    }
    return out;
  }, [grupos, porId]);
  const pajares = useMemo(() => pajaresDe(porId), [porId]);

  // El campo se actualiza al instante; la lista filtra con la consulta diferida (a menor prioridad que teclear).
  const consultaDiferida = useDeferredValue(consulta);
  const items = useMemo<ItemVerbo[]>(
    () =>
      buscarGrupos(grupos, porId, consultaDiferida, pajares).map((g) => ({
        verbo: g.verbo,
        // Sin búsqueda, todos comparten el mismo arreglo vacío: el renglón memo no se repinta.
        coinciden: g.coinciden.length === 0 ? SIN_COINCIDENCIAS : g.coinciden,
        formas: formasPorVerbo.get(g.verbo) ?? [],
      })),
    [grupos, porId, consultaDiferida, pajares, formasPorVerbo]
  );

  const abrir = (verbo: string, origen: Rect | null) => nav.navigate('PhrasalVerbo', { verbo, origen });

  return { nav, content, consulta, setConsulta, grupos, items, abrir };
}
