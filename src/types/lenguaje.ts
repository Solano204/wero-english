/* ---------- phrasal_verbs.json ---------- */

export interface PhrasalVerb {
  id: number;
  verbo: string;
  particula: string;
  /** "get up", ya armado. */
  frase: string;
  significado: string;
  ejemplo: string;
  traduccion: string;
  /** Mismo criterio que el catálogo: 0 limpio, 1 cuidado, 2 fuerte. */
  vulgaridad: 0 | 1 | 2;
  /** Si admite objeto en medio: turn it on. */
  separable: boolean;
  nota: string;
  /** A diferencia del catálogo, aquí las 207 entradas siempre traen sus seis audios. */
  audio_frase: string;
  audio_frase_lento: string;
  audio_significado: string;
  audio_ejemplo: string;
  audio_ejemplo_lento: string;
  audio_traduccion: string;
}

export interface PhrasalGrupo {
  verbo: string;
  cuantos: number;
  ids: number[];
}

/**
 * assets/data/confusiones_voz.json: palabras que suenan exactamente igual que una palabra de un par mínimo (homófonos
 * del CMU Pronouncing Dictionary), por par. Si el reconocedor escribe una, cuenta como la palabra a la que suena igual.
 */
export interface ConfusionesVozFile {
  version: number;
  fuente: string;
  nota: string;
  /** Clave: las dos palabras del par en minúsculas, en orden alfabético, unidas con «|». Valor: palabra → variantes. */
  pares: Record<string, Record<string, string[]>>;
}

export interface PhrasalFile {
  version: number;
  total: number;
  nota: string;
  grupos: PhrasalGrupo[];
  verbos: PhrasalVerb[];
}

/* ---------- gramatica.json ---------- */

/**
 * Un tema de gramática.
 *
 * La forma del objeto es la forma de la explicación, y eso es a
 * propósito: cada tema tiene que responder cuatro preguntas en orden —
 * qué es, cuándo se usa, cómo se arma y en qué te vas a equivocar.
 *
 * `error_tipico` no es un adorno. Está en todos los temas porque el
 * error del hispanohablante es el contenido más útil que hay: nadie
 * busca "present perfect", la gente busca por qué le corrigieron.
 */
export interface GramaticaTema {
  id: string;
  /** Clave del bloque al que pertenece. */
  bloque: string;
  titulo: string;
  /** Una línea que da ganas de abrirlo. */
  gancho: string;
  /** 1 a 5. */
  nivel: number;
  /** Qué es, en dos o tres frases. */
  idea: string;
  /** Cuándo se usa. */
  cuando: string;
  /** Cómo se arma. Admite **negritas** con dobles asteriscos. */
  formula: string;
  ejemplos: { en: string; es: string; audio: string; audio_lento: string; audio_es: string }[];
  error_tipico: { mal: string; bien: string; por_que: string; audio_bien: string };
  /** Nota extra. Puede faltar. */
  ojo?: string | null;
  /** Comparación entre dos formas parecidas. Puede faltar. */
  contraste?: string | null;
}

export interface GramaticaBloque {
  nombre: string;
  resumen: string;
}

export interface GramaticaFile {
  version: number;
  bloques: Record<string, GramaticaBloque>;
  temas: GramaticaTema[];
}
