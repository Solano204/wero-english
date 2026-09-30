import { useEffect, useRef, useState } from 'react';
import { celebrarSiToca, type TemaCelebracion } from '@/data/local/celebracion';

/**
 * true la primera vez que toca celebrar `tema` con esa `marca` (el día, el lunes de la semana o el récord) para
 * ese usuario: el destello sale una vez. Se pregunta cuando `activa` se prende; la marca se lee en ese momento.
 * `dependeDeLaMarca` en false: un cambio de marca por sí solo no vuelve a preguntar (la meta del día usa la
 * fecha de hoy, que no es un dato de la pantalla).
 */
export function useCelebracion(
  activa: boolean,
  usuarioId: number | null,
  tema: TemaCelebracion,
  marca: string,
  dependeDeLaMarca = true
): boolean {
  const [celebrar, setCelebrar] = useState(false);
  const marcaActual = useRef(marca);
  marcaActual.current = marca;
  const clave = dependeDeLaMarca ? marca : null;

  useEffect(() => {
    if (!activa || usuarioId === null) return;
    let vivo = true;
    void celebrarSiToca(usuarioId, tema, marcaActual.current).then((toca) => {
      if (vivo && toca) setCelebrar(true);
    });
    return () => {
      vivo = false;
    };
  }, [activa, usuarioId, tema, clave]);

  return celebrar;
}
