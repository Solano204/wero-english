import type { AlternativaVoz } from '@/types';

/* Los tipos de una escucha (services/voz.ts). Van aparte para que voz.ts quede en menos de 400 líneas. */

/** Lo que se ve mientras se escucha: preparando el micrófono → escuchando → procesando lo que oyó. */
export type EstadoEscucha = 'preparando' | 'escuchando' | 'procesando';

export interface ListenOptions {
  /**
   * Las dos palabras del par. Se le pasan al reconocedor como pistas de
   * vocabulario: convertir una transcripción libre en una decisión
   * entre dos opciones es lo que sube la precisión de aceptable a útil.
   */
  candidatos: string[];
  /** Tope desde que el reconocedor YA escucha (evento `start`), no desde el toque. */
  topeMs?: number;
  onEstado?: (estado: EstadoEscucha) => void;
  /** Volumen de la entrada, de -2 a 10 (debajo de 0 no se oye nada), unas 12 veces por segundo. */
  onVolumen?: (valor: number) => void;
  /** Lo que va entendiendo mientras hablas. */
  onParcial?: (texto: string) => void;
}

export interface ResultadoEscucha {
  /** Todas las alternativas, en orden (de confianza si el reconocedor la dio para todas). */
  alternativas: AlternativaVoz[];
  /** De dónde salieron: el resultado final, el último parcial (el final nunca llegó) o nada. */
  origen: 'final' | 'parcial' | 'nada';
  /** Los parciales que llegaron, en orden (para la pantalla de prueba). */
  parciales: string[];
  /** Se reconoció en el teléfono (sin mandar el audio a ningún lado). */
  enDispositivo: boolean;
  /** El código de error del reconocedor, si hubo ('no-speech', 'network', …). */
  error: string | null;
  /** El volumen más alto que se oyó (-2 a 10). */
  volumenMax: number;
}
