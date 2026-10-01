/**
 * Interruptores de Dulces (solo para comprobar el juego; los dos van en su valor normal).
 *
 * ANIMACION_DULCES en `false`: cada paso de la jugada se dibuja de inmediato, sin deslizar ni hacer caer las
 * piezas. Sirve para comprobar que la lógica del tablero es correcta por sí sola: si con esto en `false` el
 * tablero se ve bien, el problema está en la animación; si se ve mal, está en el modelo.
 *
 * DEPURACION_DULCES en `true`: una capa sobre el tablero muestra en cada celda lo que dice el MODELO (color e
 * id de la pieza) y marca en ámbar las celdas donde lo que se ve no coincide. En `__DEV__` va siempre encendida.
 * Además, las violaciones de las invariantes se anotan en el registro local de fallas (Ajustes → Acerca de).
 */
export const ANIMACION_DULCES = true;
export const DEPURACION_DULCES = false;
