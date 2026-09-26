import type { IndiceMarcas, MarcasAudio } from '@/domain/marcas';
import type { MarcasOraciones } from '@/domain/oraciones';

/**
 * Marcas de palabra por audio (`assets/data/marcas.json`, ver `polly.mjs --marcas`).
 *
 * El archivo va empaquetado y empieza vacío: sin marcas el karaoke estima por
 * sílabas, así que nada depende de haberlas generado. Se lee una vez.
 */
let indice: IndiceMarcas | null = null;

function cargar(): IndiceMarcas {
  if (indice) return indice;
  let leido: IndiceMarcas = {};
  try {
    const crudo: unknown = require('@data/marcas.json');
    const datos = (crudo as { default?: unknown } | null)?.default ?? crudo;
    if (datos && typeof datos === 'object') leido = datos as IndiceMarcas;
  } catch (err) {
    console.warn('[marcas] no se pudo leer marcas.json, se estimará', err);
  }
  indice = leido;
  return leido;
}

/** Las marcas de este audio, o undefined si no se generaron. */
export function marcasDe(ruta: string | null): MarcasAudio | undefined {
  if (!ruta) return undefined;
  return cargar()[ruta];
}

/**
 * Marcas de oración por audio de capítulo (`assets/data/marcas_oraciones.json`, ver `polly.mjs --marcas-oraciones`). Mismo
 * trato que las de palabra: van empaquetadas, empiezan vacías y sin ellas la lectura estima por caracteres.
 */
let indiceOraciones: Record<string, MarcasOraciones> | null = null;

function cargarOraciones(): Record<string, MarcasOraciones> {
  if (indiceOraciones) return indiceOraciones;
  let leido: Record<string, MarcasOraciones> = {};
  try {
    const crudo: unknown = require('@data/marcas_oraciones.json');
    const datos = (crudo as { default?: unknown } | null)?.default ?? crudo;
    if (datos && typeof datos === 'object') leido = datos as Record<string, MarcasOraciones>;
  } catch (err) {
    console.warn('[marcas] no se pudo leer marcas_oraciones.json, se estimará', err);
  }
  indiceOraciones = leido;
  return leido;
}

/** Las marcas de oración de este capítulo, o undefined si no se generaron. */
export function marcasOracionesDe(ruta: string | null): MarcasOraciones | undefined {
  if (!ruta) return undefined;
  return cargarOraciones()[ruta];
}
