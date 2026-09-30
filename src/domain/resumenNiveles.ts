/** Lógica pura de los destacados. Sin React: `check:practicar` la prueba con node. */
import { conteo } from '@/domain/texto';

/** Niveles de cada juego con niveles (Colmena, Pares, Caída y Dulces). */
export const TOTAL_NIVELES = 200;

export interface Niveles {
  jugados: number;
  estrellas: number;
  siguiente: number;
}

export interface ResumenNivel {
  /** «Nivel 23 · 36 estrellas». */
  texto: string;
  /** Nivel que va a jugar: llena la barra fina (nivel / TOTAL_NIVELES). */
  nivel: number;
}

/** Sin niveles (el modo no los tiene) no hay resumen. Sin jugar, arranca en el 1. */
export function resumenNivel(n: Niveles | undefined): ResumenNivel | null {
  if (!n) return null;
  if (n.jugados <= 0) return { texto: `Nivel 1 · ${TOTAL_NIVELES} niveles`, nivel: 1 };
  return {
    texto: `Nivel ${n.siguiente} · ${conteo(n.estrellas, 'estrella')}`,
    nivel: Math.min(n.siguiente, TOTAL_NIVELES),
  };
}
