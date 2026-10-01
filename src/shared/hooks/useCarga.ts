import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type DependencyList } from 'react';
import { useTemporizador } from '@/shared/hooks/useTemporizador';
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
  // El mínimo del esqueleto: se cancela solo al desmontar.
  const tiempo = useTemporizador();
  // Cuándo se prendió el esqueleto (null si esta carga nunca llegó a pintarlo).
  const demoraDesde = useRef<number | null>(null);
  const cargarRef = useRef(cargar);
  const esVacioRef = useRef(esVacio);
  // Solo __DEV__: de qué pantalla es esta carga, para el registro de tiempos de abajo.
  const ruta = useContext(NavigationRouteContext)?.name ?? 'sin ruta';
  const rutaRef = useRef(ruta);
  // Lo último que pasó la pantalla, para la carga que corre después: se anota al confirmar el render (antes de los
  // efectos que cargan), no durante el render.
  useLayoutEffect(() => {
    cargarRef.current = cargar;
    esVacioRef.current = esVacio;
    rutaRef.current = ruta;
  }, [cargar, esVacio, ruta]);

  // Las dependencias de la carga, como un número que sube cuando alguna cambia: los efectos dependen de él y no de
  // un arreglo esparcido (que ni la regla de hooks ni el React Compiler pueden revisar).
  const [claveDeps, setClaveDeps] = useState({ deps, version: 0 });
  let version = claveDeps.version;
  if (!mismasDeps(claveDeps.deps, deps)) {
    version += 1;
    setClaveDeps({ deps, version });
  }

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
      tiempo.despues(() => {
        if (vigente()) fn();
      }, espera);
    };

    try {
      const inicio = Date.now();
      const resultado = await cargarRef.current();
      // Cuánto tarda de verdad cada carga en el teléfono (sin el retraso simulado de abajo):
      // lo que decide si una pantalla necesita esqueleto o no.
      if (__DEV__) registrarDuracion(rutaRef.current, Date.now() - inicio);
      if (__DEV__) await retrasoSimulado();
      aplicar(() => {
        // Una recarga por foco que trae lo mismo conserva la referencia de antes: React no
        // repinta la pantalla (cambiar de pestaña ida y vuelta no repinta Practicar entera).
        setDatos((antes) => (silenciosa && antes !== null && igualProfundo(antes, resultado) ? antes : resultado));
        setError(null);
        setDemora(false);
        setEstado(esVacioRef.current?.(resultado) ? 'vacio' : 'listo');
      });
    } catch (err) {
      const fallo = err;
      aplicar(() => {
        if (__DEV__) console.warn('[useCarga] no se pudo cargar', fallo);
        setError(fallo);
        setDemora(false);
        setEstado('error');
      });
    }
    // Como un `finally` (el catch de arriba no deja salir errores), sin `finally`: el React Compiler no lo compila.
    if (vigente() && temporizador.current) clearTimeout(temporizador.current);
  }, [tiempo]);

  useEffect(() => {
    if (alEnfocar) return;
    void ejecutar(false);
  }, [alEnfocar, ejecutar, version]);

  const yaEnfoco = useRef(false);
  const versionEnfocada = useRef(version);
  useFocusEffect(
    useCallback(() => {
      if (!alEnfocar) return;
      // Con las dependencias nuevas (otra `version`) y la pantalla enfocada, se vuelve a cargar en silencio.
      const silenciosa = yaEnfoco.current || versionEnfocada.current !== version;
      versionEnfocada.current = version;
      yaEnfoco.current = true;
      void ejecutar(silenciosa);
    }, [alEnfocar, ejecutar, version])
  );

  const reintentar = () => void ejecutar(false);
  const refrescar = () => ejecutar(true);

  return { estado, datos, error, demora, huboEsqueleto, reintentar, refrescar };
}

/** Solo __DEV__ y con `simularCargaLenta`: el retraso para ver los esqueletos. */
async function retrasoSimulado(): Promise<void> {
  if (simularCargaLenta) await new Promise((r) => setTimeout(r, RETRASO_SIMULADO_MS));
}

/** Solo __DEV__: el registro de cuánto tardó una carga (fuera del hook: el React Compiler no compila un ternario
 *  dentro de un try). */
function registrarDuracion(ruta: string, ms: number): void {
  if (__DEV__) console.log(`[carga] ${ruta}: ${ms} ms${ms > DEMORA_ESQUELETO_MS ? ' (pinta esqueleto)' : ''}`);
}

/** Las mismas dependencias (como las compara React: `Object.is` una por una). */
function mismasDeps(a: DependencyList, b: DependencyList): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

/**
 * Igualdad estructural de lo que devuelven las cargas: primitivos, arreglos, objetos planos,
 * Map, Set y Date. Cualquier otra clase cuenta como distinta (se prefiere repintar de más).
 */
export function igualProfundo(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!igualProfundo(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !igualProfundo(v, b.get(k))) return false;
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  const protoA = Object.getPrototypeOf(a);
  if (protoA !== Object.getPrototypeOf(b) || (protoA !== Object.prototype && protoA !== null)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!igualProfundo((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}
