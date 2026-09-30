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

/* ---------- niveles.json ---------- */

/** Un tramo del catálogo del que salen las entradas de varios niveles. */
export interface BandaNivel {
  id: string;
  nombre: string;
  desde: number;
  hasta: number;
  ids: number[];
}

/** Lo común a todos los juegos. Cada uno agrega sus propios campos. */
export interface NivelBase {
  n: number;
  banda: string;
  /** Umbrales de una, dos y tres estrellas. */
  estrellas: [number, number, number];
}

export interface NivelColmena extends NivelBase {
  rondas: number;
  senuelos: number;
  pistasGratis: number;
  /** Segundos por ronda. Nunca baja de 12. */
  segundosRonda: number;
}

export interface NivelPares extends NivelBase {
  pares: number;
  jugadas: number;
  /** Segundos para el tablero completo, no por pareja. */
  segundosTablero: number;
}

export interface NivelCaida extends NivelBase {
  rondas: number;
  caidaInicialMs: number;
  caidaMinimaMs: number;
  aceleraMs: number;
}

export interface NivelDulces extends NivelBase {
  cols: number;
  rows: number;
  colores: number;
  frases: number;
  jugadas: number;
  metaPorFrase: number;
}

export type NivelJuego =
  | NivelColmena
  | NivelPares
  | NivelCaida
  | NivelDulces;

export interface JuegoNiveles {
  nombre: string;
  total: number;
  bandas: BandaNivel[];
  niveles: NivelJuego[];
}

export interface NivelesFile {
  version: number;
  nivelesPorJuego: number;
  nota: string;
  juegos: Record<string, JuegoNiveles>;
}

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
