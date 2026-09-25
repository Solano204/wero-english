/**
 * Tiempos de palabra para el karaoke de Estudio. Módulo puro: sin React ni
 * audio, así se prueba con `npm run check:marcas`.
 *
 * Los tiempos salen de dos fuentes y nunca fallan: las marcas de Polly (un
 * archivo por frase, ver `scripts/polly.mjs --marcas`) o, si no hay, una
 * estimación por sílabas repartida en la duración REAL del audio. Todo está en
 * segundos del audio (tiempo del medio), no del reloj: con "Lento" el reproductor
 * avanza más despacio por el mismo eje y el karaoke sigue sin cálculo extra.
 *
 * Lo que se ve (`phrase`) y lo que se dice (`phrase_tts`) no siempre coinciden:
 * en ~11% del catálogo la frase trae una nota entre paréntesis o una variante.
 * Por eso los tiempos se calculan sobre lo dicho y luego se alinean con lo visto.
 */

export interface MarcasAudio {
  /** Duración del mp3 al generar las marcas, en ms. Sirve para reescalar a la real. */
  d?: number;
  /** [ms desde el inicio, palabra], tal como las da Polly. */
  m: [number, string][];
}

export type IndiceMarcas = Record<string, MarcasAudio>;

/** Una palabra de la frase que se ve, con su hora en segundos del audio. */
export interface Palabra {
  texto: string;
  /** false: no se dice en el audio (una nota entre paréntesis): el karaoke no la toca. */
  hablada: boolean;
  inicio: number;
  /** Cuándo deja de ser «la actual»: donde empieza la siguiente hablada, o el fin del audio. */
  sig: number;
}

export interface Analisis {
  palabras: Palabra[];
  /** Energía de la voz de 0 a 1, `ENV_HZ` muestras por segundo, para la onda. */
  envolvente: number[];
}

interface Tiempo {
  inicio: number;
  fin: number;
}

// Perillas de calibración: los audios reales se desvían de cualquier modelo.
/** Silencio al inicio del mp3 antes de la primera palabra. */
export const ENTRADA_S = 0.12;
/** Silencio al final después de la última. */
export const SALIDA_S = 0.1;
/** Cuánto dura una sílaba cuando no se conoce la duración del audio. */
const SEG_POR_SILABA = 0.21;
/** Pausa tras coma y tras punto, en sílabas equivalentes. */
const PAUSA_COMA = 0.6;
const PAUSA_FIN = 1;
/** Mínimo de palabras dichas que deben aparecer en las marcas para fiarse de ellas. */
const MIN_ACIERTO = 0.7;
/** Diferencia de duración (fracción) por debajo de la cual no se reescalan marcas sin `d`. */
const TOLERANCIA_ESCALA = 0.12;
/** Una palabra dura al menos esto, para que su ventana nunca sea cero. */
const MIN_PALABRA_S = 0.02;
/** Muestras por segundo de la envolvente. */
export const ENV_HZ = 30;

export function trocear(texto: string): string[] {
  return texto.trim().split(/\s+/).filter(Boolean);
}

/** Forma comparable de una palabra: sin mayúsculas, apóstrofos ni puntuación. */
export function normal(palabra: string): string {
  return palabra
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9à-ÿ]/g, '');
}

/** Sílabas de una palabra en inglés (heurística: grupos de vocales menos las mudas). Los símbolos valen media. */
export function silabas(palabra: string): number {
  const p = normal(palabra);
  if (!p) return 0.5;
  if (/^\d+$/.test(p)) return Math.max(1, Math.ceil(p.length * 0.8));
  let n = (p.match(/[aeiouyà-ÿ]+/g) ?? []).length;
  if (n > 1 && /[^aeiouy]e$/.test(p) && !/le$/.test(p)) n--;
  if (n > 1 && /[^aeiouytd]ed$/.test(p)) n--;
  if (n > 1 && /[^aeiouysxzch]es$/.test(p)) n--;
  return Math.max(1, n);
}

function pausaTras(palabra: string): number {
  if (/[.!?…]["')\]]*$/.test(palabra)) return PAUSA_FIN;
  if (/[,;:—–]$/.test(palabra)) return PAUSA_COMA;
  return 0;
}

/** Duración probable de un audio del que no se sabe nada más. */
export function duracionEstimada(hablado: string[]): number {
  const unidades = hablado.reduce((suma, t) => suma + silabas(t) + pausaTras(t), 0);
  return ENTRADA_S + SALIDA_S + unidades * SEG_POR_SILABA;
}

function duracionValida(durS: number, hablado: string[]): number {
  return Number.isFinite(durS) && durS > 0 ? durS : duracionEstimada(hablado);
}

/**
 * Reparte las sílabas (y las pausas de coma y punto) en la duración del audio.
 * Cada palabra dura lo de sus sílabas; la pausa que le sigue no cuenta como suya.
 */
export function estimar(hablado: string[], durS: number): Tiempo[] {
  const n = hablado.length;
  if (n === 0) return [];
  const dur = duracionValida(durS, hablado);
  const holgura = ENTRADA_S + SALIDA_S;
  const util = dur > holgura * 2 ? dur - holgura : dur * 0.5;
  const entrada = dur > holgura * 2 ? ENTRADA_S : 0;
  const pesos = hablado.map(silabas);
  // Tras la última palabra el audio se acaba: su pausa de punto no existe.
  const pausas = hablado.map((t, i) => (i === n - 1 ? 0 : pausaTras(t)));
  const total = pesos.reduce((suma, p, i) => suma + p + (pausas[i] ?? 0), 0);
  const unidad = util / total;

  const tiempos: Tiempo[] = [];
  let cursor = entrada;
  for (let i = 0; i < n; i++) {
    const inicio = cursor;
    const fin = inicio + (pesos[i] ?? 1) * unidad;
    tiempos.push({ inicio, fin });
    cursor = fin + (pausas[i] ?? 0) * unidad;
  }
  return tiempos;
}

/** Misma palabra, o una la abreviatura de la otra ("go" por "gonna"): en la frase que se ve suele estar la forma escrita y en el audio la hablada. */
function coincide(x: string | undefined, y: string | undefined): boolean {
  if (!x || !y) return false;
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 2 && (x.startsWith(y) || y.startsWith(x));
}

/** Para cada palabra de `a`, el índice de la que le corresponde en `b`, o -1. Conserva el orden (subsecuencia común más larga). */
export function alinear(a: string[], b: string[]): number[] {
  const na = a.map(normal);
  const nb = b.map(normal);
  const ancho = nb.length + 1;
  const dp = new Array<number>((na.length + 1) * ancho).fill(0);
  for (let i = na.length - 1; i >= 0; i--) {
    for (let j = nb.length - 1; j >= 0; j--) {
      const igual = coincide(na[i], nb[j]);
      dp[i * ancho + j] = igual
        ? (dp[(i + 1) * ancho + j + 1] ?? 0) + 1
        : Math.max(dp[(i + 1) * ancho + j] ?? 0, dp[i * ancho + j + 1] ?? 0);
    }
  }
  const mapa = new Array<number>(na.length).fill(-1);
  let i = 0;
  let j = 0;
  while (i < na.length && j < nb.length) {
    if (coincide(na[i], nb[j])) {
      mapa[i] = j;
      i++;
      j++;
    } else if ((dp[(i + 1) * ancho + j] ?? 0) >= (dp[i * ancho + j + 1] ?? 0)) {
      i++;
    } else {
      j++;
    }
  }
  return mapa;
}

/** Completa los huecos (null) repartiéndolos entre el conocido anterior y el siguiente. */
function rellenar(conocidos: (number | null)[], desde: number, hasta: number): number[] {
  const salida = conocidos.map((c) => c ?? Number.NaN);
  let i = 0;
  while (i < salida.length) {
    if (!Number.isNaN(salida[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < salida.length && Number.isNaN(salida[j])) j++;
    // Del anclaje de la izquierda (una palabra conocida, o `desde`) al de la derecha (otra, o `hasta`).
    const a = i === 0 ? desde : (salida[i - 1] ?? desde);
    const b = j === salida.length ? hasta : (salida[j] ?? hasta);
    // Con `desde` la primera palabra sin marca arranca justo ahí; con una palabra conocida, un paso después.
    const salto = i > 0 ? 1 : 0;
    const intervalos = j - i + salto;
    for (let k = 0; k < j - i; k++) salida[i + k] = a + ((b - a) * (k + salto)) / intervalos;
    i = j;
  }
  return salida;
}

/** Cierra cada palabra: termina cuando acaba de decirse (sin la pausa que le sigue). */
function cerrar(hablado: string[], inicios: number[], dur: number): Tiempo[] {
  const finAudio = Math.max(dur - SALIDA_S, 0);
  return inicios.map((inicio, i) => {
    const siguiente = i < inicios.length - 1 ? (inicios[i + 1] ?? finAudio) : finAudio;
    const palabra = hablado[i] ?? '';
    const sil = silabas(palabra);
    const pausa = i < inicios.length - 1 ? pausaTras(palabra) : 0;
    const fin = inicio + Math.max(siguiente - inicio, MIN_PALABRA_S) * (sil / (sil + pausa));
    return { inicio, fin };
  });
}

/**
 * Duración del audio en el que se generaron las marcas, en segundos: la guardada
 * (`d`) o, si no viene, la que se deduce de ellas (la última palabra dura lo que
 * marca el ritmo medio de las anteriores). Las marcas salen de una llamada aparte
 * de la del mp3 y el motor generativo no siempre repite el mismo ritmo.
 */
export function duracionDeMarcas(marcas: MarcasAudio): number {
  if (marcas.d && marcas.d > 0) return marcas.d / 1000;
  const m = marcas.m;
  const primera = m[0];
  const ultima = m[m.length - 1];
  if (!primera || !ultima) return 0;
  let unidades = 0;
  for (let i = 0; i < m.length - 1; i++) {
    const palabra = m[i]?.[1] ?? '';
    unidades += silabas(palabra) + pausaTras(palabra);
  }
  const medio = unidades > 0 ? (ultima[0] - primera[0]) / 1000 / unidades : SEG_POR_SILABA;
  const ritmo = Number.isFinite(medio) && medio > 0 ? medio : SEG_POR_SILABA;
  return ultima[0] / 1000 + silabas(ultima[1]) * ritmo + SALIDA_S;
}

/**
 * Tiempos desde las marcas de Polly, reescalados a la duración real del audio.
 * Devuelve null si las marcas no se parecen a lo que se dice (menos del 70%
 * de las palabras): en ese caso se estima.
 */
export function desdeMarcas(hablado: string[], marcas: MarcasAudio, durS: number): Tiempo[] | null {
  if (hablado.length === 0 || !Array.isArray(marcas.m)) return null;
  const mapa = alinear(hablado, marcas.m.map(([, valor]) => valor));
  const acertadas = mapa.filter((j) => j >= 0).length;
  if (acertadas / hablado.length < MIN_ACIERTO) return null;

  const dMarcas = duracionDeMarcas(marcas);
  const dur = Number.isFinite(durS) && durS > 0 ? durS : dMarcas || duracionEstimada(hablado);
  const razon = dMarcas > 0 && dur > 0 ? dur / dMarcas : 1;
  // Con la duración guardada la escala es exacta. Deducida, una diferencia chica suele ser
  // silencio de sobra al final del mp3, no otro ritmo: solo se corrige si es grande.
  const escala = marcas.d || Math.abs(razon - 1) >= TOLERANCIA_ESCALA ? razon : 1;
  const conocidos = mapa.map((j) => {
    const marca = j >= 0 ? marcas.m[j] : undefined;
    return marca ? (marca[0] / 1000) * escala : null;
  });
  const inicios = rellenar(conocidos, Math.min(ENTRADA_S, dur), Math.max(dur - SALIDA_S, 0));
  return cerrar(hablado, inicios, dur);
}

/** Muestrea la voz en `ENV_HZ`: un bache por palabra, más alto cuanto más sílabas, y sin nada fuera de ellas. */
export function envolvente(tokens: string[], tiempos: Tiempo[], dur: number): number[] {
  const n = Math.max(2, Math.ceil(dur * ENV_HZ) + 1);
  const crudo = new Array<number>(n).fill(0);
  tiempos.forEach((t, k) => {
    const peso = 0.55 + 0.45 * Math.min(1, silabas(tokens[k] ?? '') / 3);
    const largo = Math.max(t.fin - t.inicio, MIN_PALABRA_S);
    const a = Math.max(0, Math.floor(t.inicio * ENV_HZ));
    const b = Math.min(n - 1, Math.ceil(t.fin * ENV_HZ));
    for (let i = a; i <= b; i++) {
      const u = Math.min(1, Math.max(0, (i / ENV_HZ - t.inicio) / largo));
      crudo[i] = Math.max(crudo[i] ?? 0, peso * Math.sin(Math.PI * u) ** 0.7);
    }
  });
  // Un suavizado corto: sin él las palabras cortas se ven como picos sueltos.
  return crudo.map((v, i) => 0.25 * (crudo[i - 1] ?? v) + 0.5 * v + 0.25 * (crudo[i + 1] ?? v));
}

/**
 * Todo lo que necesitan el karaoke y la onda: cada palabra que se ve con su
 * hora y la envolvente de la voz. Nunca lanza: sin marcas estima, y si lo que
 * se ve no se parece a lo que se dice, estima sobre lo que se ve.
 */
export function analizar(mostrada: string, hablado: string, marcas: MarcasAudio | undefined, durS: number): Analisis {
  const vistas = trocear(mostrada);
  const dichas = trocear(hablado || mostrada);
  const dur = duracionValida(durS || (marcas?.d ? marcas.d / 1000 : 0), dichas);

  let usadas = dichas;
  let tiempos = (marcas ? desdeMarcas(dichas, marcas, dur) : null) ?? estimar(dichas, dur);
  let mapa = alinear(vistas, dichas);
  if (vistas.length > 0 && mapa.every((j) => j < 0)) {
    usadas = vistas;
    tiempos = estimar(vistas, dur);
    mapa = vistas.map((_, i) => i);
  }

  // De atrás hacia adelante: cada palabra dura hasta donde empieza la siguiente hablada.
  let siguiente = Math.max(dur - SALIDA_S, 0);
  const alReves: Palabra[] = [];
  for (let i = vistas.length - 1; i >= 0; i--) {
    const texto = vistas[i] ?? '';
    const t = tiempos[mapa[i] ?? -1];
    if (!t) {
      alReves.push({ texto, hablada: false, inicio: 0, sig: 0 });
      continue;
    }
    alReves.push({ texto, hablada: true, inicio: t.inicio, sig: Math.max(siguiente, t.inicio + MIN_PALABRA_S) });
    siguiente = t.inicio;
  }
  return { palabras: alReves.reverse(), envolvente: envolvente(usadas, tiempos, dur) };
}
