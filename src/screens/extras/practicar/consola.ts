/**
 * Lógica pura de la consola de HOY. Sin React ni Skia: `check:practicar` la
 * prueba con node.
 */

/** Energía de la onda con 0 pendientes: casi plana y en calma. */
export const ENERGIA_MIN = 0.06;
/** Con estas pendientes (o más) la onda va a toda su energía. */
export const PENDIENTES_ENERGIA_MAX = 40;

/** 0.06 a 1: muchas pendientes, más energía. */
export function energiaOnda(pendientes: number): number {
  const p = Math.min(1, Math.max(0, pendientes) / PENDIENTES_ENERGIA_MAX);
  return ENERGIA_MIN + (1 - ENERGIA_MIN) * p;
}

/** Lo que llena el anillo de meta: 0 a 1. Sin meta, vacío. */
export function progresoMeta(hoy: number, meta: number): number {
  if (meta <= 0) return 0;
  return Math.min(1, Math.max(0, hoy) / meta);
}

export function metaCumplida(hoy: number, meta: number): boolean {
  return meta > 0 && hoy >= meta;
}

export function textoFrases(n: number): string {
  return `${n} ${n === 1 ? 'frase' : 'frases'}`;
}
