/**
 * Las preguntas del perfil que Wero hace al entrar (y que se editan después en Ajustes → Mi perfil).
 * Lógica pura: qué paso sigue, cuál es el anterior, si se puede avanzar y qué valores de ajustes salen
 * de las respuestas. Las respuestas no deciden qué frases te tocan: solo el filtro de lenguaje y los avisos.
 */

export type PasoPerfil = 'p1' | 'p2' | 'resumen';

export const PASOS_PERFIL: readonly PasoPerfil[] = ['p1', 'p2', 'resumen'];
/** Cuántas preguntas hay (el resumen no cuenta). */
export const TOTAL_PREGUNTAS = 2;

export interface RespuestasPerfil {
  /** null = todavía no contesta «¿Te enseñamos las groserías?». true = quiere el catálogo limpio. */
  limpio: boolean | null;
  porDia: number;
  desde: string;
  hasta: string;
}

/** Lo que se guarda mientras contesta: el paso donde va, hasta dónde llegó y sus respuestas. */
export interface BorradorPerfil {
  paso: PasoPerfil;
  /** Índice (en PASOS_PERFIL) del paso más lejano que alcanzó: hasta ahí puede saltar. */
  alcanzado: number;
  respuestas: RespuestasPerfil;
}

export interface VentanaAviso {
  label: string;
  desde: string;
  hasta: string;
}

export const VENTANAS_AVISO: readonly VentanaAviso[] = [
  { label: 'Todo el día', desde: '09:00', hasta: '21:00' },
  { label: 'Solo en la mañana', desde: '08:00', hasta: '13:00' },
  { label: 'Solo en la tarde', desde: '15:00', hasta: '21:00' },
];

export const indicePaso = (paso: PasoPerfil): number => PASOS_PERFIL.indexOf(paso);

export const pasoSiguiente = (paso: PasoPerfil): PasoPerfil =>
  PASOS_PERFIL[Math.min(indicePaso(paso) + 1, PASOS_PERFIL.length - 1)] ?? paso;

export const pasoAnterior = (paso: PasoPerfil): PasoPerfil => PASOS_PERFIL[Math.max(indicePaso(paso) - 1, 0)] ?? paso;

/** «Siguiente» se activa cuando hay respuesta. «Cuántas al día» ya viene con un valor elegido. */
export function puedeAvanzar(r: RespuestasPerfil, paso: PasoPerfil): boolean {
  return paso === 'p1' ? r.limpio !== null : true;
}

/** Solo se salta a un paso que ya se alcanzó. */
export const puedeSaltarA = (alcanzado: number, destino: PasoPerfil): boolean => indicePaso(destino) <= alcanzado;

export function textoProgreso(paso: PasoPerfil): string {
  return paso === 'resumen' ? 'Revisa tus respuestas' : `Pregunta ${indicePaso(paso) + 1} de ${TOTAL_PREGUNTAS}`;
}

/** El paso al que va «Siguiente»: el que sigue, o el resumen si venía de «Cambiar». */
export function destinoSiguiente(paso: PasoPerfil, volverAlResumen: boolean): PasoPerfil {
  return volverAlResumen ? 'resumen' : pasoSiguiente(paso);
}

export interface ValoresPerfil {
  modoLimpio: boolean;
  notifPorDia: number;
  notifDesde: string;
  notifHasta: string;
}

export function valoresFinales(r: RespuestasPerfil): ValoresPerfil {
  return { modoLimpio: r.limpio ?? false, notifPorDia: r.porDia, notifDesde: r.desde, notifHasta: r.hasta };
}

/** Lo que de verdad contestó (para «Saltar»): lo que no vio se queda como estaba. */
export function valoresContestados(r: RespuestasPerfil, alcanzado: number): Partial<ValoresPerfil> {
  const out: Partial<ValoresPerfil> = {};
  if (r.limpio !== null) out.modoLimpio = r.limpio;
  if (alcanzado >= indicePaso('p2')) {
    out.notifPorDia = r.porDia;
    out.notifDesde = r.desde;
    out.notifHasta = r.hasta;
  }
  return out;
}

export interface RenglonResumen {
  paso: PasoPerfil;
  pregunta: string;
  respuesta: string;
}

export function textoAvisos(porDia: number, desde: string, hasta: string): string {
  if (porDia <= 0) return 'Ninguna';
  const ventana = VENTANAS_AVISO.find((v) => v.desde === desde && v.hasta === hasta)?.label ?? `De ${desde} a ${hasta}`;
  return `${porDia} al día · ${ventana}`;
}

export function resumenRespuestas(r: RespuestasPerfil): RenglonResumen[] {
  return [
    {
      paso: 'p1',
      pregunta: '¿Te enseñamos las groserías?',
      respuesta: r.limpio === null ? 'Sin contestar' : r.limpio ? 'No, déjalo limpio' : 'Sí, para eso vine',
    },
    { paso: 'p2', pregunta: 'Frases todo el día', respuesta: textoAvisos(r.porDia, r.desde, r.hasta) },
  ];
}

/** Lee un borrador guardado; si está dañado o incompleto, null (se empieza de cero). */
export function leerBorrador(raw: unknown): BorradorPerfil | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<BorradorPerfil>;
  const r = b.respuestas as Partial<RespuestasPerfil> | undefined;
  if (!b.paso || !PASOS_PERFIL.includes(b.paso) || typeof b.alcanzado !== 'number' || !r) return null;
  if (!(r.limpio === null || typeof r.limpio === 'boolean')) return null;
  if (typeof r.porDia !== 'number' || typeof r.desde !== 'string' || typeof r.hasta !== 'string') return null;
  return {
    paso: b.paso,
    alcanzado: Math.min(Math.max(0, b.alcanzado), PASOS_PERFIL.length - 1),
    respuestas: { limpio: r.limpio, porDia: r.porDia, desde: r.desde, hasta: r.hasta },
  };
}
