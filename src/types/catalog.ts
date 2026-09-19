/** Tipos del catálogo. Espejo exacto de catalogo_v9.json. */

export type Tipo = 'frase' | 'expresion' | 'palabra' | 'regla_fonetica';
export type Vigencia = 'efimera' | 'estable' | 'atemporal';
export type Registro = 'formal' | 'neutro' | 'informal' | 'muy_informal';
export type TiempoVerbal =
  | 'presente'
  | 'pasado'
  | 'futuro'
  | 'condicional'
  | 'modal'
  | 'pregunta'
  | 'ninguno';
export type ReglaGrupo = 'contraccion' | 'flap_t' | 'g_perdida' | 'fusion' | 'aave';
export type Vulgaridad = 0 | 1 | 2;
export type Nivel = 1 | 2 | 3;

export interface PalabraPractica {
  palabra: string;
  ipa: string;
  audio: string;
}

export interface Entry {
  id: number;
  phrase: string;
  phrase_tts: string;
  phrase_alt: string | null;
  ipa: string;
  ipa_note: string | null;

  spanish: string;
  spanish_main: string;
  es_neutro: string;
  note: string | null;

  topic: string;
  block: string;
  volume: number;
  tipo: Tipo;
  nivel: Nivel;
  vigencia: Vigencia;
  registro: Registro;
  tiempo_verbal: TiempoVerbal;
  word_count: number;

  vulgaridad: Vulgaridad;
  vulgaridad_en: Vulgaridad;
  vulgaridad_es: Vulgaridad;
  vulgar_marks: string[];
  no_usar_cuando: string | null;

  pack_id: string;
  mundo: string;
  pack_final: string;

  duplicate_of: number | null;
  is_canonical: boolean;
  revisar: boolean;
  revisar_motivo: string | null;

  escena_imagen: string | null;
  completar_palabra: string | null;
  completar_distractores: string[];

  regla_grupo: ReglaGrupo | null;
  palabras_practica: PalabraPractica[];

  audio_en: string;
  audio_es: string | null;
  imagen: string | null;
}

export interface Catalog {
  total: number;
  schema_version: number;
  entries: Entry[];
}
