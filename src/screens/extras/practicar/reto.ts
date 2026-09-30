/** Lógica pura del reto de la semana. Sin React: `check:practicar` la prueba con node. */
import { conteo, plural } from '@/domain/texto';

const DIAS_SEMANA = 7;
const MS_DIA = 24 * 60 * 60 * 1000;

function utc(dia: string): number {
  const [y, m, d] = dia.split('-').map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

/**
 * Días que quedan de la semana contando hoy: el lunes son 7 y el domingo 1.
 * `desde` es el lunes del reto y `hoy` el día actual, los dos YYYY-MM-DD.
 */
export function diasQueQuedan(desde: string, hoy: string): number {
  const transcurridos = Math.round((utc(hoy) - utc(desde)) / MS_DIA);
  return Math.min(DIAS_SEMANA, Math.max(1, DIAS_SEMANA - transcurridos));
}

export function textoDiasReto(restantes: number): string {
  return `${plural(restantes, 'Queda', 'Quedan')} ${conteo(restantes, 'día')}`;
}
