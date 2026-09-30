import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getWorldCounts } from '@/data/repos/estadisticas';
import { searchEntries } from '@/data/repos/frases';
import { useCarga } from '@/shared/hooks/useCarga';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Cuánto se espera sin teclear antes de buscar. */
const ESPERA_BUSQUEDA_MS = 150;

/**
 * Explorar: los mundos del catálogo y su avance.
 */
export function useExplorar() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const content = useMemo(loadContent, []);

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Entry[]>([]);

  const cargaMundos = useCarga(
    async (): Promise<Record<string, { total: number; vistas: number }>> =>
      user ? getWorldCounts(user.id, filter()) : {},
    [user, filter],
    { alEnfocar: true }
  );

  // Se busca cuando se deja de teclear (no en cada tecla), y una respuesta vieja nunca pisa a
  // la de lo último que se escribió.
  const pedida = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
    },
    []
  );
  const buscar = useCallback(
    (t: string) => {
      setTerm(t);
      const id = ++pedida.current;
      if (espera.current) clearTimeout(espera.current);
      if (t.trim().length < 2) {
        setResults([]);
        return;
      }
      espera.current = setTimeout(() => {
        searchEntries(t, filter(), 30)
          .then((r) => {
            if (id === pedida.current) setResults(r);
          })
          .catch(() => undefined);
      }, ESPERA_BUSQUEDA_MS);
    },
    [filter]
  );
  const abrir = useCallback((e: Entry) => nav.navigate('Detail', { entryId: e.id }), [nav]);

  const mundos = useMemo(() => [...content.packs.mundos].sort((a, b) => a.orden - b.orden), [content]);
  const buscando = term.trim().length >= 2;

  return { nav, term, results, cargaMundos, buscar, abrir, mundos, buscando };
}
