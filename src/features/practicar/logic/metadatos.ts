/** El dato de cada renglón de "Todo lo demás". Sin React: `check:practicar` lo prueba con node. */
import { conteo } from '@/domain/texto';
import type { ModoId } from './hoy';
import type { Niveles } from '@/domain/resumenNiveles';

export type Meta =
  | { tipo: 'nivel'; nivel: number; estrellas: number }
  | { tipo: 'nuevo' }
  | { tipo: 'atoradas'; n: number }
  | { tipo: 'guardadas'; n: number }
  | { tipo: 'texto'; texto: string };

export interface FuentesMeta {
  niveles: Record<string, Niveles>;
  records: Record<string, { partidas: number; mejor: number }>;
  paresLimpios: number;
  atoradas: number;
  guardadas: number;
  frasesPhrasal: number;
}

/** Con niveles, lo útil es dónde te quedaste; sin ellos, el mejor puntaje. Sin dato, null: el renglón queda limpio. */
export function metaDe(id: ModoId, f: FuentesMeta): Meta | null {
  switch (id) {
    case 'colmena':
    case 'pares':
    case 'caida':
    case 'dulces':
    case 'cazala': {
      const n = f.niveles[id];
      if (n) return n.jugados > 0 ? { tipo: 'nivel', nivel: n.siguiente, estrellas: n.estrellas } : { tipo: 'nivel', nivel: 1, estrellas: 0 };
      const r = f.records[id];
      return r && r.partidas > 0 ? { tipo: 'texto', texto: `mejor: ${r.mejor}` } : null;
    }
    case 'pares_minimos':
      return f.paresLimpios > 0
        ? { tipo: 'texto', texto: conteo(f.paresLimpios, 'par limpio', 'pares limpios') }
        : { tipo: 'nuevo' };
    case 'phrasal':
      return { tipo: 'texto', texto: conteo(f.frasesPhrasal, 'frase') };
    case 'atoran':
      return f.atoradas > 0 ? { tipo: 'atoradas', n: f.atoradas } : null;
    case 'mazo':
      return f.guardadas > 0 ? { tipo: 'guardadas', n: f.guardadas } : null;
    default:
      return null;
  }
}

/** El mismo dato como una línea de texto (la de una tarjeta destacada sin niveles). */
export function textoMeta(m: Meta | null): string | null {
  if (!m) return null;
  switch (m.tipo) {
    case 'nivel':
      return m.estrellas > 0 ? `Nivel ${m.nivel} · ${conteo(m.estrellas, 'estrella')}` : `Nivel ${m.nivel}`;
    case 'nuevo':
      return 'nuevo';
    case 'atoradas':
      return conteo(m.n, 'frase');
    case 'guardadas':
      return conteo(m.n, 'guardada');
    case 'texto':
      return m.texto;
  }
}
