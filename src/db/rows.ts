import type { Entry, PalabraPractica } from '@/types';

/** Fila cruda de SQLite: los arrays y booleanos van serializados. */
export interface EntryRow {
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
  tipo: string;
  nivel: number;
  vigencia: string;
  registro: string;
  tiempo_verbal: string;
  word_count: number;
  vulgaridad: number;
  vulgaridad_en: number;
  vulgaridad_es: number;
  vulgar_marks: string;
  no_usar_cuando: string | null;
  pack_id: string;
  mundo: string;
  pack_final: string;
  duplicate_of: number | null;
  is_canonical: number;
  revisar: number;
  escena_imagen: string | null;
  completar_palabra: string | null;
  completar_distractores: string;
  regla_grupo: string | null;
  palabras_practica: string;
  audio_en: string;
  audio_es: string | null;
  imagen: string | null;
}

function parseArray<T>(raw: string, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

/** Convierte una fila de SQLite en un Entry tipado. */
export function toEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    phrase: r.phrase,
    phrase_tts: r.phrase_tts,
    phrase_alt: r.phrase_alt,
    ipa: r.ipa,
    ipa_note: r.ipa_note,
    spanish: r.spanish,
    spanish_main: r.spanish_main,
    es_neutro: r.es_neutro,
    note: r.note,
    topic: r.topic,
    block: r.block,
    volume: r.volume,
    tipo: r.tipo as Entry['tipo'],
    nivel: r.nivel as Entry['nivel'],
    vigencia: r.vigencia as Entry['vigencia'],
    registro: r.registro as Entry['registro'],
    tiempo_verbal: r.tiempo_verbal as Entry['tiempo_verbal'],
    word_count: r.word_count,
    vulgaridad: r.vulgaridad as Entry['vulgaridad'],
    vulgaridad_en: r.vulgaridad_en as Entry['vulgaridad'],
    vulgaridad_es: r.vulgaridad_es as Entry['vulgaridad'],
    vulgar_marks: parseArray<string>(r.vulgar_marks, []),
    no_usar_cuando: r.no_usar_cuando,
    pack_id: r.pack_id,
    mundo: r.mundo,
    pack_final: r.pack_final,
    duplicate_of: r.duplicate_of,
    is_canonical: r.is_canonical === 1,
    revisar: r.revisar === 1,
    revisar_motivo: null,
    escena_imagen: r.escena_imagen,
    completar_palabra: r.completar_palabra,
    completar_distractores: parseArray<string>(r.completar_distractores, []),
    regla_grupo: r.regla_grupo as Entry['regla_grupo'],
    palabras_practica: parseArray<PalabraPractica>(r.palabras_practica, []),
    audio_en: r.audio_en,
    audio_es: r.audio_es,
    imagen: r.imagen,
  };
}
