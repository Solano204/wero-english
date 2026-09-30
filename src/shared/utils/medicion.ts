/**
 * Cronómetro del arranque para la serie de rendimiento (docs/RENDIMIENTO.md).
 *
 * Mide desde que empieza a correr el JS (`__BUNDLE_START_TIME__`, que Metro pone en la primera
 * línea del bundle con el mismo reloj que `nativePerformanceNow`) hasta que Practicar está
 * interactivo: sus datos llegaron y ya se pintó el primer cuadro con ellos.
 *
 * Solo corre en __DEV__ o en un release armado con EXPO_PUBLIC_MEDIR=1. En release sale por
 * console.error, el único console que Babel deja en producción: se lee con
 *   adb logcat -s ReactNativeJS | grep "\[medir\]"
 */

declare const __BUNDLE_START_TIME__: number | undefined;

const ACTIVA = __DEV__ || process.env.EXPO_PUBLIC_MEDIR === '1';
let practicarMarcado = false;

function ahora(): number {
  const g = globalThis as { nativePerformanceNow?: () => number };
  return typeof g.nativePerformanceNow === 'function' ? g.nativePerformanceNow() : Date.now();
}

/** Se llama cuando Practicar ya pintó sus datos. Solo cuenta la primera vez de la sesión de la app. */
export function marcarPracticarInteractivo(): void {
  if (!ACTIVA || practicarMarcado) return;
  practicarMarcado = true;
  const inicio = typeof __BUNDLE_START_TIME__ === 'number' ? __BUNDLE_START_TIME__ : null;
  if (inicio === null) return;
  const ms = Math.round(ahora() - inicio);
  const linea = `[medir] Practicar interactivo: ${ms} ms desde el inicio del JS`;
  if (__DEV__) console.log(linea);
  else console.error(linea);
}
