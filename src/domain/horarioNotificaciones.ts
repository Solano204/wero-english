/**
 * Reglas puras de las notificaciones: a qué hora caen dentro de la ventana permitida y si la condición de una
 * plantilla se cumple. Sin Expo ni base: se prueban con Node.
 */

/** Tope duro. Más allá el sistema las agrupa y el usuario las apaga. */
export const MAX_POR_DIA = 12;

/** La hora que el usuario puso, recortada a la ventana permitida. */
export function horaExacta(
  hora: string,
  ventana: string
): { hour: number; minute: number } {
  const lim = limitesDe(ventana);
  const m = clampMin(toMinutos(hora, 20 * 60), lim);
  return { hour: Math.floor(m / 60), minute: m % 60 };
}

/**
 * Reparte n horas dentro de la ventana, con los extremos hacia adentro.
 *
 * Si se repartiera de borde a borde, la primera caería a las 9:00 en
 * punto, que es cuando la gente está entrando al trabajo, y la última
 * justo a la hora de dormir. Media hora de margen a cada lado quita ese
 * problema sin acortar la ventana de verdad.
 */
export function repartirHoras(
  desde: string,
  hasta: string,
  n: number,
  ventana: string
): { hour: number; minute: number }[] {
  const lim = limitesDe(ventana);
  const ini = clampMin(toMinutos(desde, 9 * 60), lim);
  const fin = clampMin(toMinutos(hasta, 21 * 60), lim);

  // Ventana invertida o de un solo punto: una sola, en el inicio.
  if (fin <= ini + 30 || n === 1) {
    const m = Math.round((ini + fin) / 2);
    return [{ hour: Math.floor(m / 60), minute: m % 60 }];
  }

  const margen = Math.min(30, Math.floor((fin - ini) / (n + 1)));
  const a = ini + margen;
  const b = fin - margen;
  const paso = (b - a) / (n - 1);

  const out: { hour: number; minute: number }[] = [];
  for (let i = 0; i < n; i++) {
    const m = Math.round(a + paso * i);
    out.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return out;
}

function toMinutos(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return fallback;
  return Math.min(23 * 60 + 59, Math.max(0, h * 60 + min));
}

function limitesDe(ventana: string): { min: number; max: number } {
  const win = /(\d{2}):(\d{2})-(\d{2}):(\d{2})/.exec(ventana);
  if (!win) return { min: 6 * 60, max: 22 * 60 };
  return {
    min: Number(win[1]) * 60 + Number(win[2]),
    max: Number(win[3]) * 60 + Number(win[4]),
  };
}

function clampMin(v: number, lim: { min: number; max: number }): number {
  return Math.min(lim.max, Math.max(lim.min, v));
}

export function condicionCumple(
  cond: string,
  data: { due: number; stuck: number; racha: number }
): boolean {
  if (cond === 'siempre') return true;
  if (cond === 'tarjetas_vencidas==0') return data.due === 0;

  const due = /tarjetas_vencidas>=(\d+)/.exec(cond);
  if (due) return data.due >= Number(due[1]);

  const stuck = /existe_entrada_con_fallos>=(\d+)/.exec(cond);
  if (stuck) return data.stuck > 0;

  const racha = /racha>=(\d+)/.exec(cond);
  if (racha) return data.racha >= Number(racha[1]);

  // Los módulos v1.1 y v1.2 aún no existen: sus plantillas no aplican.
  if (cond.includes('modulo_') || cond.includes('lectura_')) return false;

  return false;
}
