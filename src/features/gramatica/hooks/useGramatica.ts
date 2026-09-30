import { useEffect, useMemo, useState } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { nivelMaximo } from '@/domain/gramatica';
import { loadContent } from '@/data/contenido';
import { useUnlockStore } from '@/estado/useUnlockStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { RootStackParams } from '@/types/rutas';
import type { GramaticaTema } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Gramática: los temas y su avance.
 */
export function useGramatica() {
  const nav = useNavigation<Nav>();
  const enfocada = useIsFocused();
  const reducido = useMovimientoReducido();
  const { gramatica } = loadContent();
  const claves = useUnlockStore((s) => s.claves);
  // Lo que se abre con un anuncio dentro del tema se refleja al volver a la lista, no antes: así el candado se ve abrirse.
  const [clavesVistas, setClavesVistas] = useState(claves);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Misma pista que el resto de la app, pero más baja: aquí se lee.
  useMusicaPantalla('app', { volumenFactor: 0.4 });

  useEffect(() => {
    if (enfocada) setClavesVistas(claves);
  }, [enfocada, claves]);

  const porBloque = useMemo(() => {
    const m = new Map<string, GramaticaTema[]>();
    for (const t of gramatica.temas) {
      const lista = m.get(t.bloque) ?? [];
      lista.push(t);
      m.set(t.bloque, lista);
    }
    return m;
  }, [gramatica]);
  const niveles = nivelMaximo(gramatica.temas);

  const bloques = Object.entries(gramatica.bloques);
  const abrirTema = (tema: GramaticaTema) => nav.navigate('GramaticaTema', { temaId: tema.id });

  return { nav, reducido, gramatica, clavesVistas, abierto, setAbierto, porBloque, niveles, bloques, abrirTema };
}
