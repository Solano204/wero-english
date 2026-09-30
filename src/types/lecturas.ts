/* ---------- lecturas.json ---------- */

export interface LecturaCapitulo {
  n: number;
  titulo: string;
  texto: string;
  /** null mientras no exista la pasada de TTS por capítulo. */
  audio: string | null;
}

export interface LecturaPregunta {
  pregunta: string;
  opciones: string[];
  correcta: number;
  porque: string;
}

export interface LecturaDesbloqueo {
  mundo: string;
  dominadas: number;
}

export interface Lectura {
  id: string;
  titulo: string;
  subtitulo: string;
  /** 'ninos' baja el registro y quita todo lo que no sea para menores. */
  publico: 'ninos' | 'general';
  mundo: string;
  nivel: 1 | 2 | 3;
  palabras: number;
  /** null = abierta desde el primer día. */
  desbloquea: LecturaDesbloqueo | null;
  audio: string | null;
  capitulos: LecturaCapitulo[];
  /** Ids del catálogo que aparecen literales en el texto. */
  frases: number[];
  preguntas: LecturaPregunta[];
}

export interface LecturasFile {
  version: number;
  total: number;
  nota_frases: string;
  nota_audio: string;
  lecturas: Lectura[];
}
