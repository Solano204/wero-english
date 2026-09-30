/** Un trozo de texto de un párrafo: con o sin negrita, cursiva o enlace. */
export interface Parte {
  texto: string;
  negrita?: boolean;
  cursiva?: boolean;
  url?: string;
}

export type Bloque =
  | { t: 'h2' | 'h3' | 'p'; partes: Parte[] }
  | { t: 'li'; partes: Parte[] }
  | { t: 'ol'; n: number; partes: Parte[] };

export type DocLegal = 'privacidad' | 'terminos' | 'eliminar';

export interface TextoLegal {
  titulo: string;
  /** Fecha de última actualización, AAAA-MM-DD. */
  fecha: string;
  bloques: Bloque[];
}
