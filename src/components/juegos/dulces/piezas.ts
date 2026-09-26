/**
 * Qué es cada pieza de Dulces además de su color: su forma y su nombre. Módulo puro (`npm run check:dulces`):
 * no toca la pantalla ni el dominio (`domain/match3.ts` sigue sabiendo solo de números). Cada color lleva
 * SIEMPRE su forma propia, así el juego se puede jugar sin distinguir colores (daltonismo): el índice de
 * color de una pieza decide las dos cosas a la vez.
 */

export type Forma = 'circulo' | 'triangulo' | 'cuadrado' | 'rombo' | 'estrella' | 'hexagono';

/** Una forma por color, en el orden de los tintes de `theme.pieza`. Los niveles piden de 4 a 6 colores. */
export const FORMAS: readonly Forma[] = ['circulo', 'triangulo', 'cuadrado', 'rombo', 'estrella', 'hexagono'];

export const COLORES_MAX = FORMAS.length;

/** Cómo se dice cada forma en voz alta. */
export const NOMBRE_FORMA: Record<Forma, string> = {
  circulo: 'círculo',
  triangulo: 'triángulo',
  cuadrado: 'cuadrado',
  rombo: 'rombo',
  estrella: 'estrella',
  hexagono: 'hexágono',
};

/** Cómo se dice cada color en voz alta, en el orden de los tintes de `theme.pieza`. */
export const NOMBRE_COLOR: readonly string[] = ['naranja', 'azul', 'verde', 'lila', 'lima', 'turquesa'];

/** El lado del recuadro en el que están dibujados los trazos de `TRAZOS`. */
export const CAJA = 24;

/** Un polígono regular de `n` lados con su centro en la caja, como trazo SVG. */
function poligono(n: number, radio: number, giro: number): string {
  const c = CAJA / 2;
  const puntos: string[] = [];
  for (let i = 0; i < n; i++) {
    const ang = giro + (i * 2 * Math.PI) / n;
    puntos.push(`${(c + radio * Math.cos(ang)).toFixed(2)} ${(c + radio * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${puntos.join(' L')} Z`;
}

/** Una estrella de cinco puntas: alterna el radio de fuera y el de dentro. */
function estrella(radioFuera: number, radioDentro: number): string {
  const c = CAJA / 2;
  const puntos: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radio = i % 2 === 0 ? radioFuera : radioDentro;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    puntos.push(`${(c + radio * Math.cos(ang)).toFixed(2)} ${(c + 0.6 + radio * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${puntos.join(' L')} Z`;
}

/**
 * El trazo de cada forma, en una caja de `CAJA` x `CAJA`. Se rellenan y se contornean con la misma tinta y
 * unión redondeada, así las esquinas salen suaves y todas pesan parecido.
 */
export const TRAZOS: Record<Forma, string> = {
  circulo: `M${CAJA / 2 - 8} ${CAJA / 2} a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z`,
  triangulo: poligono(3, 9.6, -Math.PI / 2),
  cuadrado: 'M5.5 5.5 L18.5 5.5 L18.5 18.5 L5.5 18.5 Z',
  rombo: poligono(4, 9.6, -Math.PI / 2),
  estrella: estrella(10, 4.4),
  hexagono: poligono(6, 9, 0),
};

/** La forma que lleva un color (un color fuera de rango da la vuelta: nunca queda una pieza sin forma). */
export function formaDe(color: number): Forma {
  const i = ((Math.trunc(color) % COLORES_MAX) + COLORES_MAX) % COLORES_MAX;
  return FORMAS[i] ?? 'circulo';
}

export function nombreColor(color: number): string {
  const i = ((Math.trunc(color) % COLORES_MAX) + COLORES_MAX) % COLORES_MAX;
  return NOMBRE_COLOR[i] ?? 'gris';
}

/**
 * Lo que oye el lector de pantalla de una pieza: «Pieza naranja, círculo, fila 2 columna 3». `fila` y
 * `col` vienen de cero (como en el tablero) y se dicen de uno.
 */
export function etiquetaPieza(color: number, fila: number, col: number): string {
  return `Pieza ${nombreColor(color)}, ${NOMBRE_FORMA[formaDe(color)]}, fila ${fila + 1} columna ${col + 1}`;
}
