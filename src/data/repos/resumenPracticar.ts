import type { ContentFilter } from '@/types';
import { correrLote } from './lote';
import { parteHabla, parteRecords, parteReto, parteUso } from './partidas';
import { parteResumenNiveles } from './niveles';
import { parteStats } from './estadisticas';
import { parteDiasRecientes } from './progreso';
import { parteContarNuevas, parteContarVencidas } from './tarjetas';

/**
 * Todo lo que Practicar pinta al abrir, en UNA consulta: récords, reto, habla, niveles, estadísticas, uso de cada
 * modo, el día de hoy y los conteos de la cola (vencidas y nuevas, con el filtro de estudio). Cada parte es la misma
 * consulta que corre sola en su repo (getGameRecords, getRetoSemanal…) y se lee igual.
 */
export function getResumenPracticar(usuarioId: number, filtro: ContentFilter) {
  return correrLote({
    records: parteRecords(usuarioId),
    reto: parteReto(usuarioId),
    habla: parteHabla(usuarioId),
    niveles: parteResumenNiveles(usuarioId),
    stats: parteStats(usuarioId),
    uso: parteUso(usuarioId),
    dias: parteDiasRecientes(usuarioId, 1),
    vencidas: parteContarVencidas(usuarioId, filtro),
    nuevas: parteContarNuevas(usuarioId, filtro),
  });
}
