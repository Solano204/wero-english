import type { AlternativaVoz } from '@/types';

/**
 * Lectura de lo que manda el reconocedor de voz (expo-speech-recognition), sin nada nativo: se prueba en
 * scripts/check-voz.mjs.
 */

/**
 * Todas las alternativas de un evento `result`, en el orden del reconocedor, sin vacías ni repetidas.
 *
 * El payload cambia de forma entre versiones y plataformas: `{ results: [{ transcript, confidence }] }` (SDK 57),
 * `{ transcript }` o `{ value: string[] }` (versiones viejas). Se leen las tres: una transcripción perdida se ve como
 * «no te entendí», que es el peor mensaje posible cuando la persona sí habló.
 */
export function extraerAlternativas(payload: unknown): AlternativaVoz[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  const crudas: AlternativaVoz[] = [];

  const results = p['results'];
  if (Array.isArray(results)) {
    for (const r of results) {
      if (!r || typeof r !== 'object') continue;
      const t = (r as Record<string, unknown>)['transcript'];
      const c = (r as Record<string, unknown>)['confidence'];
      if (typeof t === 'string') crudas.push({ texto: t, confianza: confianzaValida(c) });
    }
  }
  if (crudas.length === 0) {
    const directo = p['transcript'];
    if (typeof directo === 'string') crudas.push({ texto: directo, confianza: confianzaValida(p['confidence']) });
  }
  if (crudas.length === 0) {
    const value = p['value'];
    if (Array.isArray(value)) {
      for (const v of value) if (typeof v === 'string') crudas.push({ texto: v, confianza: null });
    }
  }

  const vistas = new Set<string>();
  const salida: AlternativaVoz[] = [];
  for (const a of crudas) {
    const texto = a.texto.trim();
    const clave = texto.toLowerCase();
    if (texto.length === 0 || vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push({ texto, confianza: a.confianza });
  }
  return salida;
}

/**
 * La confianza solo cuenta si es un número de verdad entre 0 y 1. El reconocedor manda -1 («no disponible») y, en
 * Android, 0 para las alternativas a las que no les calculó una; las dos cosas son «no se sabe», no «confianza cero».
 */
function confianzaValida(c: unknown): number | null {
  return typeof c === 'number' && Number.isFinite(c) && c > 0 && c <= 1 ? c : null;
}

/**
 * En orden de confianza. El reconocedor ya las manda de la más a la menos probable; solo se reordena si TODAS traen
 * confianza (si no, los ceros y los -1 de Android desordenarían la lista sin razón). El orden es estable.
 */
export function ordenarPorConfianza(alternativas: readonly AlternativaVoz[]): AlternativaVoz[] {
  if (alternativas.length < 2 || alternativas.some((a) => a.confianza === null)) return [...alternativas];
  return alternativas
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (y.a.confianza as number) - (x.a.confianza as number) || x.i - y.i)
    .map((x) => x.a);
}
