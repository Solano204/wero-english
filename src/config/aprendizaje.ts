/**
 * En qué orden llegan las frases NUEVAS a cada usuario (las vencidas siempre salen por su fecha
 * de SM-2, `vence_en`, que ya es distinta para cada quien).
 *
 *  - 'aleatorio': orden totalmente al azar, distinto para cada usuario y estable para el mismo
 *    usuario (ver `ordenNuevas` en src/db/cola.ts). Lo de hoy.
 *  - 'aleatorio_por_nivel': primero todas las de nivel 1, luego las de 2 y luego las de 3; dentro
 *    de cada nivel, el mismo orden al azar por usuario. Por si a quien empieza le tocan frases
 *    muy difíciles.
 *
 * Cambiarlo no toca lo ya estudiado: solo reordena las nuevas que faltan.
 */
export type OrdenNuevas = 'aleatorio' | 'aleatorio_por_nivel';

export const ORDEN_NUEVAS: OrdenNuevas = 'aleatorio';
