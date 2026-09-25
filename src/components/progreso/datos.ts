/**
 * Lógica pura de la pantalla de Progreso. Sin React ni Skia: `check:practicar` la
 * prueba con node.
 */
import { TOTAL_NIVELES, type Niveles } from '@/screens/extras/practicar/resumenNiveles';
import { conteo, miles, plural } from '@/utils/text';

/* ── Medidor y chips ─────────────────────────────────────────────────── */

/** Lo dominado sobre el total: 0 a 1. Sin total, 0. */
export function ratio(dominadas: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, dominadas) / total);
}

/** «frases dominadas de 1,436». */
export function textoDominadas(dominadas: number, total: number): string {
  return `${plural(dominadas, 'frase dominada', 'frases dominadas')} de ${miles(total)}`;
}

/** «128 vistas». */
export function textoVistas(vistas: number): string {
  return conteo(vistas, 'vista');
}

/** Lo que lee el lector de pantalla en el medidor. */
export function etiquetaMedidor(dominadas: number, total: number, vistas: number): string {
  return `${conteo(dominadas, 'frase dominada', 'frases dominadas')} de ${miles(total)}, ${textoVistas(vistas)}`;
}

/** «1 día seguido». Sin racha, no hay chip. */
export function textoRacha(racha: number): string | null {
  return racha > 0 ? conteo(racha, 'día seguido', 'días seguidos') : null;
}

/** La racha de hoy iguala o supera el récord. */
export function esRecordActual(racha: number, rachaMax: number): boolean {
  return rachaMax > 0 && racha >= rachaMax;
}

/** «Récord: 4 días» o «Récord actual». Sin récord, no hay chip. */
export function textoRecord(racha: number, rachaMax: number): string | null {
  if (rachaMax <= 0) return null;
  return esRecordActual(racha, rachaMax) ? 'Récord actual' : `Récord: ${conteo(rachaMax, 'día')}`;
}

/* ── Espectrograma ───────────────────────────────────────────────────── */

export interface DiaGrafica {
  dia: string;
  respuestas: number;
  aciertos: number;
}

export const DIAS_GRAFICA = 21;
export const DIAS_POR_BLOQUE = 7;
const MS_DIA = 86_400_000;
/** Alto mínimo de una columna con actividad: un día con una respuesta no desaparece. */
const ALTO_MIN_COLUMNA = 3;
const INICIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;
const ABREVIATURAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

function utc(dia: string): number {
  const [y, m, d] = dia.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function clave(ms: number): string {
  const f = new Date(ms);
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}`;
}

/** Los 21 días que terminan hoy (YYYY-MM-DD local), del más viejo al más nuevo; sin registro entran en cero. */
export function ventana(dias: DiaGrafica[], hoy: string): DiaGrafica[] {
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const fin = utc(hoy);
  return Array.from({ length: DIAS_GRAFICA }, (_, i) => {
    const dia = clave(fin - (DIAS_GRAFICA - 1 - i) * MS_DIA);
    const d = porDia.get(dia);
    const respuestas = d?.respuestas ?? 0;
    return { dia, respuestas, aciertos: Math.min(d?.aciertos ?? 0, respuestas) };
  });
}

/** El día con más respuestas: la referencia de la escala. Nunca menos de 1. */
export function maximo(dias: DiaGrafica[]): number {
  return Math.max(1, ...dias.map((d) => d.respuestas));
}

/** Escala de raíz cuadrada: un día muy alto no aplasta a los demás. El máximo llena `alto`. */
export function alturaColumna(respuestas: number, max: number, alto: number): number {
  if (respuestas <= 0) return 0;
  return Math.min(alto, Math.max(ALTO_MIN_COLUMNA, alto * Math.sqrt(respuestas / max)));
}

/** La inicial del día de la semana: L M M J V S D. */
export function inicial(dia: string): string {
  return INICIALES[new Date(utc(dia)).getUTCDay()] ?? '';
}

/** «Mar 15 · 42 respuestas · 30 aciertos». */
export function etiquetaDia(d: DiaGrafica): string {
  const cabeza = `${ABREVIATURAS[new Date(utc(d.dia)).getUTCDay()]} ${Number(d.dia.slice(8))}`;
  if (d.respuestas <= 0) return `${cabeza} · sin práctica`;
  return `${cabeza} · ${conteo(d.respuestas, 'respuesta')} · ${conteo(d.aciertos, 'acierto')}`;
}

/** El resumen que lee el lector de pantalla en la gráfica. */
export function resumenAccesible(dias: DiaGrafica[]): string {
  const activos = dias.filter((d) => d.respuestas > 0).length;
  if (activos === 0) return 'Últimas tres semanas: sin días con práctica.';
  const respuestas = dias.reduce((s, d) => s + d.respuestas, 0);
  const aciertos = dias.reduce((s, d) => s + d.aciertos, 0);
  const pct = Math.round((aciertos / respuestas) * 100);
  return `Últimas tres semanas: ${conteo(activos, 'día')} con práctica, ${conteo(respuestas, 'respuesta')}, ${pct} % de aciertos.`;
}

/** Los días con práctica como líneas de texto: la lista alternativa de la gráfica. */
export function listaAccesible(dias: DiaGrafica[]): string[] {
  return dias.filter((d) => d.respuestas > 0).map(etiquetaDia);
}

/* ── Por mundo ───────────────────────────────────────────────────────── */

export interface MundoBase {
  id: string;
  nombre: string;
  orden: number;
}

export interface ProgresoMundo {
  total: number;
  dominadas: number;
}

export interface FilaMundoDatos extends MundoBase, ProgresoMundo {
  fraccion: number;
}

/** Los mundos con frases, del que más domina al que menos. Con 0 dominadas se quedan: barra vacía. */
export function filasMundo(mundos: MundoBase[], progreso: Record<string, ProgresoMundo>): FilaMundoDatos[] {
  return mundos
    .map((m) => {
      const total = progreso[m.id]?.total ?? 0;
      const dominadas = Math.min(progreso[m.id]?.dominadas ?? 0, total);
      return { ...m, total, dominadas, fraccion: total > 0 ? dominadas / total : 0 };
    })
    .filter((f) => f.total > 0)
    .sort((a, b) => b.dominadas - a.dominadas || a.orden - b.orden);
}

/** «12 de 340». */
export function textoMundo(f: ProgresoMundo): string {
  return `${f.dominadas} de ${miles(f.total)}`;
}

/* ── Por juego ───────────────────────────────────────────────────────── */

export const JUEGOS_PROGRESO = ['colmena', 'pares', 'caida', 'dulces', 'cazala'] as const;
export type JuegoProgreso = (typeof JUEGOS_PROGRESO)[number];

export type ResumenJuego =
  | { tipo: 'nivel'; nivel: number; estrellas: number; fraccion: number }
  | { tipo: 'partidas'; partidas: number; mejor: number }
  | { tipo: 'sinJugar' };

/**
 * Colmena, Pares, Caída y Dulces tienen niveles: se muestra el más alto desbloqueado y las
 * estrellas. Cázala no los tiene: solo su dato real (partidas y mejor). Sin partidas, «Sin jugar».
 */
export function resumenJuego(
  id: JuegoProgreso,
  niveles: Record<string, Niveles>,
  records: Record<string, { partidas: number; mejor: number }>
): ResumenJuego {
  if (id === 'cazala') {
    const r = records[id];
    return r && r.partidas > 0 ? { tipo: 'partidas', partidas: r.partidas, mejor: r.mejor } : { tipo: 'sinJugar' };
  }
  const n = niveles[id];
  if (!n || n.jugados <= 0) return { tipo: 'sinJugar' };
  const nivel = Math.min(n.siguiente, TOTAL_NIVELES);
  return { tipo: 'nivel', nivel, estrellas: n.estrellas, fraccion: nivel / TOTAL_NIVELES };
}

/** «Nivel 23 de 200», «3 partidas · mejor 12» o «Sin jugar». */
export function textoJuego(r: ResumenJuego): string {
  switch (r.tipo) {
    case 'nivel':
      return `Nivel ${r.nivel} de ${TOTAL_NIVELES}`;
    case 'partidas':
      return `${conteo(r.partidas, 'partida')} · mejor ${r.mejor}`;
    case 'sinJugar':
      return 'Sin jugar';
  }
}

/* ── Detalle ─────────────────────────────────────────────────────────── */

/** La precisión (0 a 1) como porcentaje entero, sin salirse de 0 a 100. */
export function precisionPct(precision: number): number {
  return Math.min(100, Math.max(0, Math.round(precision * 100)));
}
