import type { IndiceMarcas, MarcasAudio } from '@/domain/marcas';

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
