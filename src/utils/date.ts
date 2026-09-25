import { conteo } from '@/utils/text';

const MS_DAY = 86_400_000;

/** Clave de día en hora local, formato YYYY-MM-DD. */
export function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Medianoche local del día que contiene ts. */
export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Días completos entre dos claves YYYY-MM-DD.
 * Se compara a mediodía para que el horario de verano no cambie el conteo.
 */
export function daysBetween(a: string, b: string): number {
  const pa = parseKey(a);
  const pb = parseKey(b);
  if (!pa || !pb) return 999;
  return Math.round((pb - pa) / MS_DAY);
}

function parseKey(key: string): number | null {
  const parts = key.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}

/**
 * Suma días de calendario en hora local. Sumar `days * 24 h` en ms se
 * corre un día en las zonas con horario de verano (frontera norte de
 * México): un día tiene 23 o 25 h dos veces al año.
 */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** "hace 3 días", "hoy", "en 2 semanas". Para P-12 y P-13. */
export function relativeDay(ts: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(ts) - startOfDay(now)) / MS_DAY);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff === -1) return 'ayer';
  if (diff < 0) {
    const n = Math.abs(diff);
    if (n < 7) return `hace ${conteo(n, 'día')}`;
    if (n < 30) return `hace ${conteo(Math.round(n / 7), 'semana')}`;
    return `hace ${conteo(Math.round(n / 30), 'mes', 'meses')}`;
  }
  if (diff < 7) return `en ${conteo(diff, 'día')}`;
  if (diff < 30) return `en ${conteo(Math.round(diff / 7), 'semana')}`;
  return `en ${conteo(Math.round(diff / 30), 'mes', 'meses')}`;
}

/** Formatea milisegundos como "3 min" o "45 s". */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return `${m} min`;
}
