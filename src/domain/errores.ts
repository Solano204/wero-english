import type { ErrorCard, ErrorCategoria } from '@/types';

/**
 * Lo puro de Errores que te delatan: los filtros con su cuenta, el orden, las etiquetas de gravedad, el encabezado y lo que
 * se anuncia y se comparte de un error. Solo importa tipos: se prueba con `npm run check:errores`, sin jest.
 */

export type FiltroErrores = ErrorCategoria | 'todos';
/** `graves`: los que cambian el significado primero. `orden`: como vienen en el contenido. */
export type OrdenErrores = 'graves' | 'orden';

export const CATEGORIAS_ERRORES: readonly { id: FiltroErrores; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'falso_amigo', label: 'Falsos amigos' },
  { id: 'calco', label: 'Calcos' },
  { id: 'gramatica', label: 'Gramática' },
  { id: 'preposicion', label: 'Preposiciones' },
  { id: 'pronunciacion', label: 'Pronunciación' },
  { id: 'registro', label: 'Tono' },
  { id: 'escritura', label: 'Escritura' },
];

export const ORDENES_ERRORES: readonly { id: OrdenErrores; label: string }[] = [
  { id: 'graves', label: 'Más graves primero' },
  { id: 'orden', label: 'En orden' },
];

/** Lo que dice el ajuste guardado: lo que no se reconoce vuelve al orden de siempre (los más graves primero). */
export function normalizarOrden(valor: unknown): OrdenErrores {
  return valor === 'orden' ? 'orden' : 'graves';
}

/** Cuántos errores hay en cada categoría, y en total bajo `todos`: siempre sobre todos, no sobre el filtro que esté puesto. */
export function conteoPorCategoria(errores: readonly Pick<ErrorCard, 'categoria'>[]): Record<FiltroErrores, number> {
  const cuenta = Object.fromEntries(CATEGORIAS_ERRORES.map((c) => [c.id, 0])) as Record<FiltroErrores, number>;
  for (const e of errores) {
    cuenta[e.categoria] += 1;
    cuenta.todos += 1;
  }
  return cuenta;
}

/** Los errores del filtro, en el orden pedido. No modifica la lista que recibe. El orden solo reordena: nunca filtra. */
export function filtrarYOrdenar<T extends Pick<ErrorCard, 'categoria' | 'gravedad' | 'orden'>>(
  errores: readonly T[],
  filtro: FiltroErrores,
  orden: OrdenErrores
): T[] {
  const lista = errores.filter((e) => filtro === 'todos' || e.categoria === filtro);
  return orden === 'graves'
    ? lista.sort((a, b) => b.gravedad - a.gravedad || a.orden - b.orden)
    : lista.sort((a, b) => a.orden - b.orden);
}

export const ETIQUETA_GRAVEDAD = { 1: 'Suena raro', 2: 'Te delata', 3: 'Cambia el significado' } as const;

export function etiquetaGravedad(gravedad: 1 | 2 | 3): string {
  return ETIQUETA_GRAVEDAD[gravedad];
}

/** Lo que oye el lector de pantalla del medidor: la gravedad nunca se comunica solo con las barras. */
export function anuncioGravedad(gravedad: 1 | 2 | 3): string {
  return `Gravedad: ${etiquetaGravedad(gravedad)}, ${gravedad} de 3`;
}

export interface EncabezadoErrores {
  /** El número que rueda en el marcador. */
  numero: number;
  /** Lo que va después del número: «errores» sin filtro, «de 194» con filtro. */
  resto: string;
  /** Todo junto, para el lector de pantalla. */
  anuncio: string;
}

/** «194 errores» sin filtro; «32 de 194» con filtro. */
export function encabezadoErrores(filtro: FiltroErrores, mostrados: number, total: number): EncabezadoErrores {
  if (filtro === 'todos') return { numero: mostrados, resto: 'errores', anuncio: `${mostrados} errores` };
  return { numero: mostrados, resto: `de ${total}`, anuncio: `${mostrados} de ${total} errores` };
}

/** Cierra la frase con punto, salvo que ya termine en uno o en ? ! …: así una pregunta no queda con dos signos. */
function conPunto(texto: string): string {
  return /[.?!…]$/.test(texto.trim()) ? texto.trim() : `${texto.trim()}.`;
}

type Malentendido = Pick<ErrorCard, 'lo_que_dices' | 'lo_que_entienden' | 'lo_correcto'>;

/** Lo que oye el lector de pantalla del malentendido completo, en orden. */
export function anuncioDeError(e: Malentendido): string {
  return `Lo que dices: ${conPunto(e.lo_que_dices)} Lo que entienden: ${conPunto(e.lo_que_entienden)} Lo correcto: ${conPunto(e.lo_correcto)}`;
}

/** El texto del menú de compartir: la frase incorrecta, lo que entienden, la correcta y una línea de la app. */
export function textoParaCompartir(e: Malentendido): string {
  return (
    `Decía «${e.lo_que_dices.trim()}» y lo que entienden es «${e.lo_que_entienden.trim()}». ` +
    `Se dice «${e.lo_correcto.trim()}».\nLo aprendí con Wero.`
  );
}

/** Los tiempos de la secuencia del detalle (ms). Los pone `motion.ts`; aquí llegan por parámetro para poder probarlos. */
export interface TiemposMalentendido {
  /** Duración total máxima de los tres pasos. */
  tope: number;
  /** Lo más pronto y lo más tarde que puede arrancar el paso c. */
  cMin: number;
  cMax: number;
  /** Lo que tarda en tacharse una palabra, la pausa entre tachar y resolver, y el retraso con que entra lo nuevo. */
  tacha: number;
  pausa: number;
  entra: number;
  /** Lo que dura la llegada de una palabra nueva y la del ícono ✓. */
  entraSube: number;
  icono: number;
  /** Sin morph: cuánto se espera antes de mostrar la correcta y lo que tarda en aparecer. */
  escena: number;
  aparecerSubiendo: number;
  /** El retraso escalonado del lugar `i` entre las palabras que se tachan o que entran. */
  escalon: (i: number) => number;
}

/** Cuánto dura la corrección de «Lo correcto», de que empieza a tacharse a que termina de llegar la frase correcta. */
export function duracionCorreccion(modo: 'morph' | 'fundido', tachas: number, entradas: number, t: TiemposMalentendido): number {
  if (modo === 'fundido') return t.escena + t.aparecerSubiendo;
  const tachado = tachas === 0 ? 0 : t.tacha + t.escalon(tachas - 1);
  const llegada = entradas === 0 ? t.entra + t.icono : t.entra + t.escalon(entradas - 1) + t.entraSube;
  return tachado + t.pausa + llegada;
}

/** Cuándo arranca el paso c: lo más tarde que deje la corrección terminar dentro del tope, entre `cMin` y `cMax`. */
export function inicioDeCorreccion(duracion: number, t: TiemposMalentendido): number {
  return Math.min(t.cMax, Math.max(t.cMin, t.tope - duracion));
}
