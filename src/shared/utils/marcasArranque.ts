/**
 * Marcas del arranque para la serie de rendimiento (docs/RENDIMIENTO.md, «Arranque»).
 *
 * Cada marca guarda cuánto pasó desde que empezó a correr el JS (`__BUNDLE_START_TIME__`, que Metro pone en la
 * primera línea del bundle con el mismo reloj que `nativePerformanceNow`). Al llegar a `interactivo` (Practicar ya
 * pintó sus datos) se imprime una sola línea con todos los tramos y el bloqueo más largo del hilo de JS:
 *
 *   [medir] app 180 · base 260 · catalogo 300 · fuentes 310 · splash 330 · primerRender 520 · interactivo 690 ms
 *           · bloqueo máx 140 ms (2 > 100 ms)
 *
 * Solo corre en __DEV__ o en un release armado con EXPO_PUBLIC_MEDIR=1 (la variable se inlinea al compilar: en el
 * release normal todo esto es código muerto). En release sale por console.error, el único console que Babel deja:
 *   adb logcat -s ReactNativeJS | grep "\[medir\]"      (o scripts/medir-arranque.sh)
 */

declare const __BUNDLE_START_TIME__: number | undefined;

export type Marca = 'app' | 'base' | 'catalogo' | 'fuentes' | 'splash' | 'primerRender' | 'interactivo';

const ORDEN: Marca[] = ['app', 'base', 'catalogo', 'fuentes', 'splash', 'primerRender', 'interactivo'];
const ACTIVA = __DEV__ || process.env.EXPO_PUBLIC_MEDIR === '1';
/** Cada cuánto mira el vigía si el hilo de JS se quedó trabado. */
const PASO_VIGIA_MS = 16;
/** Un tramo sin que el vigía corra de más de esto cuenta como bloqueo. */
const BLOQUEO_MS = 100;

const marcas: Partial<Record<Marca, number>> = {};
let bloqueoMax = 0;
let bloqueos = 0;
let vigia: ReturnType<typeof setInterval> | null = null;
let ultimoLatido = 0;

function ahora(): number {
  const g = globalThis as { nativePerformanceNow?: () => number };
  return typeof g.nativePerformanceNow === 'function' ? g.nativePerformanceNow() : Date.now();
}

const inicio = (): number | null => (typeof __BUNDLE_START_TIME__ === 'number' ? __BUNDLE_START_TIME__ : null);

function arrancarVigia(): void {
  if (vigia) return;
  ultimoLatido = ahora();
  vigia = setInterval(() => {
    const t = ahora();
    const hueco = t - ultimoLatido - PASO_VIGIA_MS;
    ultimoLatido = t;
    if (hueco > bloqueoMax) bloqueoMax = hueco;
    if (hueco > BLOQUEO_MS) bloqueos++;
  }, PASO_VIGIA_MS);
}

function imprimir(): void {
  const tramos = ORDEN.filter((m) => marcas[m] !== undefined).map((m) => `${m} ${Math.round(marcas[m] ?? 0)}`);
  const linea = `[medir] ${tramos.join(' · ')} ms · bloqueo máx ${Math.round(bloqueoMax)} ms (${bloqueos} > ${BLOQUEO_MS} ms)`;
  if (__DEV__) console.log(linea);
  else console.error(linea);
}

/** Anota una marca (solo la primera vez de la sesión de la app). `interactivo` imprime el resumen. */
export function marcar(m: Marca): void {
  if (!ACTIVA || marcas[m] !== undefined) return;
  const cero = inicio();
  if (cero === null) return;
  marcas[m] = ahora() - cero;
  if (m === 'app') arrancarVigia();
  if (m === 'interactivo') {
    // El vigía sigue un momento más: lo que corre justo después de ser interactivo también cuenta.
    setTimeout(() => {
      if (vigia) clearInterval(vigia);
      vigia = null;
      imprimir();
    }, 3000);
  }
}

/** Practicar ya pintó sus datos (el primer cuadro con ellos). */
export const marcarPracticarInteractivo = (): void => marcar('interactivo');
