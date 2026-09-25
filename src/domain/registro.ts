/**
 * El registro de una frase como escala de 5 pasos, de formal a lenguaje explícito.
 * Módulo puro (`npm run check:estudio`).
 *
 * El catálogo tiene cuatro registros (formal, neutro, informal, muy informal) y la
 * vulgaridad es otro eje (0, 1 o 2). El quinto paso, «Solo con amigos» (la misma
 * copia que el badge de riesgo), es para la vulgaridad 2: manda sobre el registro,
 * porque es lo que le importa saber al usuario antes de decirla.
 */

export const PASOS_REGISTRO = ['Formal', 'Neutro', 'Informal', 'Muy informal', 'Solo con amigos'] as const;

/** Índice del último paso: el lenguaje explícito. */
export const PASO_EXPLICITO = PASOS_REGISTRO.length - 1;

const REGISTROS = ['formal', 'neutro', 'informal', 'muy_informal'] as const;

/** El paso (0 a 4) de una frase. Un registro que no se conoce cae en «Neutro». */
export function pasoRegistro(registro: string, vulgaridad: number): number {
  if (vulgaridad >= 2) return PASO_EXPLICITO;
  const i = (REGISTROS as readonly string[]).indexOf(registro);
  return i >= 0 ? i : 1;
}

/** Lo que dice el lector de pantalla: «Registro: muy informal, 4 de 5». */
export function textoRegistro(paso: number): string {
  const acotado = Math.min(PASO_EXPLICITO, Math.max(0, Math.round(paso)));
  return `Registro: ${(PASOS_REGISTRO[acotado] ?? PASOS_REGISTRO[1]).toLowerCase()}, ${acotado + 1} de ${PASOS_REGISTRO.length}`;
}
