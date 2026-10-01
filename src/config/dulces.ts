/**
 * Banderas de Dulces.
 *
 * ANIMACION_DULCES: con `false`, cada jugada se dibuja directo del modelo (sin intercambio animado, sin estallidos ni
 * caídas) y las metas suben de una vez. Sirve para comprobar en el teléfono que la lógica del tablero es correcta por
 * sí sola: si con `false` no hay huecos ni movimientos raros, el problema está en las animaciones.
 */
export const ANIMACION_DULCES = true;

/**
 * Marca de esta versión del juego. La muestra la capa de depuración (pulsación larga sobre «jugadas») para saber en
 * el teléfono si el APK instalado trae los últimos cambios. Súbela cada vez que cambie la lógica de Dulces.
 */
export const MARCA_DULCES = 'dulces-4 · modelo única fuente';
