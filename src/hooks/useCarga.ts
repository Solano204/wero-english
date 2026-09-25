import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export type EstadoCarga = 'cargando' | 'listo' | 'vacio' | 'error';

/** Antes de esto no se pinta esqueleto: una carga corta no debe parpadear. */
export const DEMORA_ESQUELETO_MS = 300;

export interface ResultadoCarga<T> {
  estado: EstadoCarga;
  datos: T | null;
  error: unknown;
  /** true cuando la carga ya pasó de DEMORA_ESQUELETO_MS: recién ahí toca el esqueleto. */
  demora: boolean;
  /** Vuelve a cargar mostrando el estado de carga (botón "Reintentar"). */
  reintentar: () => void;
  /** Recarga sin volver a 'cargando': lo que ya se ve se queda hasta que llegue lo nuevo (jalar para refrescar). */
  refrescar: () => Promise<void>;
}

interface Opciones<T> {
  /** ¿No hay nada que mostrar? Deja el estado en 'vacio'. */
  esVacio?: (datos: T) => boolean;
  /** Además de al montar, recarga cada vez que la pantalla vuelve a tener el foco. */
  alEnfocar?: boolean;
}

/**
 * Forma única de cargar datos en una pantalla. Ignora la respuesta si la
 * pantalla ya se desmontó o si salió otra petición después. Las recargas por
 * foco no vuelven a 'cargando': lo que ya se ve se queda hasta que llegue lo nuevo.
 */
export function useCarga<T>(
  cargar: () => Promise<T>,
  deps: DependencyList = [],
  { esVacio, alEnfocar = false }: Opciones<T> = {}
): ResultadoCarga<T> {
  const [estado, setEstado] = useState<EstadoCarga>('cargando');
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [demora, setDemora] = useState(false);

  const vivo = useRef(true);
  const pedido = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  const esVacioRef = useRef(esVacio);
  esVacioRef.current = esVacio;

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const ejecutar = useCallback(async (silenciosa: boolean) => {
    const mio = ++pedido.current;
    const vigente = () => vivo.current && mio === pedido.current;
    if (temporizador.current) clearTimeout(temporizador.current);
    if (!silenciosa) {
      setEstado('cargando');
      setDemora(false);
      temporizador.current = setTimeout(() => {
        if (vigente()) setDemora(true);
      }, DEMORA_ESQUELETO_MS);
    }
    try {
      const resultado = await cargarRef.current();
      if (!vigente()) return;
      setDatos(resultado);
      setError(null);
      setEstado(esVacioRef.current?.(resultado) ? 'vacio' : 'listo');
    } catch (err) {
      if (!vigente()) return;
      console.warn('[useCarga] no se pudo cargar', err);
      setError(err);
      setEstado('error');
    } finally {
      if (vigente()) {
        if (temporizador.current) clearTimeout(temporizador.current);
        setDemora(false);
      }
    }
  }, []);

  useEffect(() => {
    if (alEnfocar) return;
    void ejecutar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alEnfocar, ejecutar, ...deps]);

  const yaEnfoco = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!alEnfocar) return;
      const silenciosa = yaEnfoco.current;
      yaEnfoco.current = true;
      void ejecutar(silenciosa);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alEnfocar, ejecutar, ...deps])
  );

  const reintentar = useCallback(() => void ejecutar(false), [ejecutar]);
  const refrescar = useCallback(() => ejecutar(true), [ejecutar]);

  return { estado, datos, error, demora, reintentar, refrescar };
}
