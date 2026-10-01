import type { Registro, Vulgaridad } from './catalog';

/* ---------- errores_final.json ---------- */

export type ErrorCategoria =
  | 'falso_amigo'
  | 'calco'
  | 'gramatica'
  | 'preposicion'
  | 'pronunciacion'
  | 'registro'
  | 'escritura';

export interface ErrorCard {
  id: string;
  orden: number;
  categoria: ErrorCategoria;
  gravedad: 1 | 2 | 3;
  lo_que_dices: string;
  lo_que_entienden: string;
  lo_correcto: string;
  ipa_correcto: string;
  por_que: string;
  escena_imagen: string;
  imagen: string;
  audio: string;
  audio_contraste: string | null;
  audio_contraste_archivo: string | null;
  entrada_relacionada: number | null;
  compartible: boolean;
}

export interface ErroresFile {
  version: number;
  total: number;
  nota_ipa: string;
  errores: ErrorCard[];
}

/* ---------- situaciones.json ---------- */

export interface Arquetipo {
  id: string;
  nombre: string;
  orden: number;
  max_vulgaridad: Vulgaridad;
  registros_ok: Registro[];
  razon_no: string | null;
  razon_si: string;
  escena_imagen: string;
  imagen: string;
}

export interface Escenario {
  id: string;
  arquetipo: string;
  titulo: string;
  subtitulo: string;
  escena_imagen: string;
  imagen: string | null;
}

export interface SituacionesFile {
  version: number;
  rondas_por_partida: number;
  nota_juez: string;
  nota_seleccion: string;
  nota_imagen: string;
  arquetipos: Arquetipo[];
  escenarios: Escenario[];
}

/* ---------- contracciones.json ---------- */

export interface GrupoReduccion {
  id: string;
  nombre: string;
  descripcion: string;
  orden: number;
  total: number;
  entradas: number[];
}

export interface CazalaItem {
  id: string;
  frase_real: string;
  frase_formal: string;
  frase_es: string;
  reducciones: number[];
  distractores: number[];
  opciones: number[];
  dificultad: 1 | 2 | 3;
  velocidad: string;
  audio: string;
  audio_lento: string;
  audio_es: string;
}

export interface ContraccionesFile {
  version: number;
  total_reducciones: number;
  total_cazala: number;
  nota_opciones: string;
  grupos: GrupoReduccion[];
  cazala: CazalaItem[];
}

/* ---------- fonemas_final.json ---------- */

export interface FonemaEjemplo {
  palabra: string;
  ipa: string;
  spanish: string;
  audio: string;
}

export interface ParMinimo {
  a: string;
  a_ipa: string;
  a_es: string;
  b: string;
  b_ipa: string;
  b_es: string;
  contrasta_con: string | null;
  audio_a: string;
  audio_b: string;
}

export interface Fonema {
  id: string;
  ipa: string;
  tipo: string;
  nombre: string;
  existe_en_espanol: boolean;
  dificultad: 1 | 2 | 3;
  como_producirlo: string;
  el_error_tipico: string;
  ejemplos: FonemaEjemplo[];
  pares_minimos: ParMinimo[];
  escena_imagen: string | null;
  imagen: string | null;
  audio: string;
  audio_manual: boolean;
  /** null mientras audio_manual sea true: no hay sonido aislado que ralentizar. */
  audio_lento: string | null;
  palabra_ancla: string;
  orden: number;
  /** true mientras sus textos estén pendientes de revisión. */
  borrador?: boolean;
}

export interface ReglaCaso {
  cuando: string;
  suena: string;
  truco: string;
  ejemplos: FonemaEjemplo[];
}

export interface ReglaFonetica {
  id: string;
  tipo: string;
  titulo: string;
  subtitulo: string;
  explicacion: string;
  casos: ReglaCaso[];
  escena_imagen: string | null;
  imagen: string | null;
  orden: number;
}

export interface FonemasFile {
  version: number;
  total_fonemas: number;
  total_reglas: number;
  fonemas: Fonema[];
  reglas: ReglaFonetica[];
}

/* ---------- notificaciones.json ---------- */

export interface NotifPlantilla {
  id: string;
  texto: string;
  condicion: string;
  peso: number;
  fuente: string;
  abre_en: string;
}

export interface NotifVuelta {
  id: string;
  texto: string;
  condicion: string;
  fuente: string;
  abre_en: string;
}

export interface NotificacionesFile {
  version: number;
  reglas: {
    max_vulgaridad: Vulgaridad;
    solo_entradas_descargadas: boolean;
    no_repetir_en_dias: number;
    max_por_dia: number;
    ventana_horaria: string;
    nota: string;
  };
  plantillas: NotifPlantilla[];
  vuelta: NotifVuelta[];
  prohibido: string[];
}
