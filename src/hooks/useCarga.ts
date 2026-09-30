import { useCallback, useContext, useEffect, useRef, useState, type DependencyList } from 'react';
import { NavigationRouteContext, useFocusEffect } from '@react-navigation/native';

export type EstadoCarga = 'cargando' | 'listo' | 'vacio' | 'error';

/** Antes de esto no se pinta esqueleto: una carga corta no debe parpadear. */
export const DEMORA_ESQUELETO_MS = 150;
/** Una vez que el esqueleto ya se pintó, se queda al menos esto: si no, una carga que
 * termina un instante después destella en vez de sentirse continua. */
export const MINIMO_ESQUELETO_MS = 300;

/** Solo __DEV__: cuánto se le suma a cada carga con "Simular carga lenta" prendido en Ajustes. */
const RETRASO_SIMULADO_MS = 1500;
let simularCargaLenta = false;
/** La usa el interruptor de Ajustes: solo tiene efecto en __DEV__. */
export function setSimularCargaLenta(v: boolean): void {
  simularCargaLenta = v;
}

export interface ResultadoCarga<T> {
  estado: EstadoCarga;
  datos: T | null;
  error: unknown;
  /** true cuando la carga ya pasó de DEMORA_ESQUELETO_MS: recién ahí toca el esqueleto. */
  demora: boolean;
  /**
   * La última carga llegó a pintar el esqueleto (se queda en true ya con los datos). Lo usan
   * las pantallas con esqueleto propio para hacer el fundido cruzado solo cuando hubo huesos.
   */
  huboEsqueleto: boolean;
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
  const [huboEsqueleto, setHuboEsqueleto] = useState(false);

  const vivo = useRef(true);
  const pedido = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cuándo se prendió el esqueleto (null si esta carga nunca llegó a pintarlo).
  const demoraDesde = useRef<number | null>(null);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  const esVacioRef = useRef(esVacio);
  esVacioRef.current = esVacio;
  // Solo __DEV__: de qué pantalla es esta carga, para el registro de tiempos de abajo.
  const ruta = useContext(NavigationRouteContext)?.name ?? 'sin ruta';
  const rutaRef = useRef(ruta);
  rutaRef.current = ruta;

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
      setHuboEsqueleto(false);
      demoraDesde.current = null;
      temporizador.current = setTimeout(() => {
        if (vigente()) {
          demoraDesde.current = Date.now();
          setDemora(true);
          setHuboEsqueleto(true);
        }
      }, DEMORA_ESQUELETO_MS);
    }

    // Si el esqueleto ya se pintó, el resultado espera lo que falte de
    // MINIMO_ESQUELETO_MS antes de aplicarse: sin esto, una carga que
    // termina un instante después de aparecer el esqueleto lo hace
    // destellar en vez de sentirse continua.
    const aplicar = (fn: () => void) => {
      if (!vigente()) return;
      const espera =
        demoraDesde.current !== null
          ? Math.max(0, MINIMO_ESQUELETO_MS - (Date.now() - demoraDesde.current))
          : 0;
      if (espera === 0) {
        fn();
        return;
      }
      setTimeout(() => {
        if (vigente()) fn();
      }, espera);
    };

    try {
      const inicio = Date.now();
      const resultado = await cargarRef.current();
      if (__DEV__) {
        // Cuánto tarda de verdad cada carga en el teléfono (sin el retraso simulado de abajo):
        // lo que decide si una pantalla necesita esqueleto o no.
        const ms = Date.now() - inicio;
        console.log(`[carga] ${rutaRef.current}: ${ms} ms${ms > DEMORA_ESQUELETO_MS ? ' (pinta esqueleto)' : ''}`);
      }
      if (__DEV__ && simularCargaLenta) {
        await new Promise((r) => setTimeout(r, RETRASO_SIMULADO_MS));
      }
      aplicar(() => {
        setDatos(resultado);
        setError(null);
        setDemora(false);
        setEstado(esVacioRef.current?.(resultado) ? 'vacio' : 'listo');
      });
    } catch (err) {
      aplicar(() => {
        console.warn('[useCarga] no se pudo cargar', err);
        setError(err);
        setDemora(false);
        setEstado('error');
      });
    } finally {
      if (vigente() && temporizador.current) clearTimeout(temporizador.current);
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

  return { estado, datos, error, demora, huboEsqueleto, reintentar, refrescar };
}
