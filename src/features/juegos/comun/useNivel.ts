import { useEffect, useMemo, useState } from 'react';
import { nivelDesbloqueado } from '@/data/repos/niveles';
import { loadContent } from '@/data/contenido';
import { useAuthStore } from '@/estado/useAuthStore';
import type { Entry, JuegoId, NivelJuego } from '@/types';

/**
 * Resuelve qué nivel se va a jugar y qué entradas le tocan.
 *
 * Los cuatro juegos hacen lo mismo aquí, así que vive en un solo lugar:
 * si el nivel viene por parámetro se usa ese, y si no, el siguiente sin
 * terminar. Sin esto, cada juego tendría su propia copia de la misma
 * consulta y en dos meses una estaría desfasada de las otras.
 */
export function useNivel(juego: JuegoId, pedido?: number) {
  const user = useAuthStore((s) => s.user);
  const content = loadContent();
  const def = content.niveles.juegos[juego];

  // El nivel pedido se usa tal cual (derivado, no copiado a estado); sin pedido, el siguiente sin terminar.
  const [desbloqueado, setDesbloqueado] = useState<number | null>(null);
  const nivel = pedido ? pedido : desbloqueado;

  useEffect(() => {
    if (pedido || !user || !def) return;
    let vivo = true;
    void nivelDesbloqueado(user.id, juego).then((n) => {
      if (vivo) setDesbloqueado(Math.min(n, def.total));
    });
    return () => {
      vivo = false;
    };
  }, [user, juego, pedido, def]);

  const config: NivelJuego | null = useMemo(() => {
    if (!def || nivel === null) return null;
    return def.niveles[Math.min(nivel, def.total) - 1] ?? null;
  }, [def, nivel]);

  const banda = useMemo(() => {
    if (!def || !config) return null;
    return def.bandas.find((b) => b.id === config.banda) ?? null;
  }, [def, config]);

  /**
   * Deja solo las entradas de la banda del nivel.
   *
   * Si la banda deja menos de lo que el nivel necesita, se devuelve la
   * bolsa completa. Vale más un nivel un poco fuera de banda que un
   * nivel que no se puede jugar: el usuario no sabe qué es una banda y
   * sí sabe cuándo una pantalla se queda vacía.
   */
  const filtrar = useMemo(() => {
    const ids = banda ? new Set(banda.ids) : null;
    return (pool: Entry[], minimo: number): Entry[] => {
      if (!ids) return pool;
      const dentro = pool.filter((e) => ids.has(e.id));
      return dentro.length >= minimo ? dentro : pool;
    };
  }, [banda]);

  return { nivel, config, banda, total: def?.total ?? 0, filtrar };
}
