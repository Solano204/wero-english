import { levenshtein, mismoTexto } from '@/domain/texto';

/**
 * Los distractores de Reconocer y Escuchar: las tres traducciones falsas que acompañan a la correcta.
 *
 * Una opción falsa buena no se distingue de la correcta sin entender la frase. Hay cuatro maneras de delatarla
 * sin entender nada, y este módulo las evita:
 *
 *  - Un número: si la frase trae «240» y la única opción con «240» es la correcta, se contesta sin leer. Vale igual
 *    en dígitos y en palabra («veinte»).
 *  - Un nombre propio («Netflix», «Kendrick»): la única opción que lo trae es la correcta.
 *  - Un cognado evidente: una palabra de la traducción que se ve igual que una de la frase («important» e
 *    «importante»).
 *  - Repetirse: si el mismo distractor sale en tarjetas seguidas, ya se sabe que es falso. Y una opción que es la
 *    misma traducción con otra puntuación tampoco sirve: hay dos correctas.
 *
 * Módulo puro: sin base ni React, así se prueba con `npm run check:distractores` sobre el catálogo real.
 */

/**
 * Dos palabras de 5 letras o más que empiezan con la misma letra son cognados si se parecen al menos esto (1 menos
 * la distancia de Levenshtein sobre el largo de la más larga, sin acentos): «different» y «diferente» dan 0.78,
 * «innocent» e «inocente» 0.75 y «system» y «sistema» 0.71. En el catálogo, 0.70 marca 277 frases de 1,510, 0.75
 * marca 237, 0.80 marca 196 y 0.85 marca 149: 0.75 es el punto donde entran los cognados de siempre sin colar
 * palabras que solo comparten letras. Pedir la misma inicial deja fuera unos pocos («school» y «escuela») y vuelve la
 * comparación unas veinte veces más barata.
 */
export const UMBRAL_COGNADO = 0.75;
/** Menos letras que esto y dos palabras se parecen por casualidad («es» y «is»). */
export const MIN_LETRAS_COGNADO = 5;
/** Dos palabras con más diferencia de largo que esto no son cognados: se descartan sin calcular la distancia. */
const MAX_DIFERENCIA_LETRAS = 3;
/** Dos traducciones que se parecen al menos esto (misma medida) cuentan como la misma: no van juntas. */
export const UMBRAL_CASI_IGUAL = 0.9;
/** Cuántas palabras de diferencia como máximo para que dos frases cuenten como «del mismo tamaño». */
const DIFERENCIA_PALABRAS = 3;

// «one» y «un/uno» no cuentan: son artículo y pronombre tanto como número («no one», «un día»).
const NUMEROS_EN =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen)\b/i;
const NUMEROS_ES =
  /\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci\w+|veinte|veinti\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|\w+cientos|mil|mill[oó]n|millones|docena)\b/i;

/** Palabras de función que se escriben con mayúscula al empezar un renglón o después de una barra: no son nombres. */
const NO_ES_NOMBRE = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'of', 'for', 'with', 'my', 'your']);

/** ¿Trae dígitos? */
export function tieneDigitos(texto: string): boolean {
  return /\d/.test(texto);
}

/** ¿Trae un número escrito con letras («twenty», «veinte»)? */
export function tienePalabraNumero(texto: string, idioma: 'en' | 'es'): boolean {
  return (idioma === 'en' ? NUMEROS_EN : NUMEROS_ES).test(texto);
}

/**
 * Los nombres propios del texto: palabras con mayúscula que NO están al inicio de un renglón (ni después de un
 * punto, una barra, dos puntos o «¿»/«¡»), sin dígitos y que no son palabras de función. «You got a Hellcat» da
 * `['Hellcat']`; «Hello there», nada; «I'm a D1 rage baiter», nada.
 */
export function nombresPropios(texto: string): string[] {
  const nombres: string[] = [];
  let inicio = true;
  for (const crudo of texto.split(/\s+/)) {
    if (!crudo) continue;
    const limpio = crudo.replace(/^[^\p{L}\d]+|[^\p{L}\d'’]+$/gu, '');
    if (limpio) {
      const esNombre =
        !inicio &&
        /^\p{Lu}/u.test(limpio) &&
        !/\d/.test(limpio) &&
        !/^I(['’]\w+)?$/.test(limpio) &&
        !NO_ES_NOMBRE.has(limpio.toLowerCase());
      if (esNombre) nombres.push(limpio);
    }
    inicio = /[.!?…:;]["'”’)]*$/.test(crudo) || /^[/–—-]$/.test(crudo);
  }
  return nombres;
}

function sinAcentos(palabra: string): string {
  return palabra
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

function palabrasLargas(texto: string): string[] {
  return texto
    .split(/\s+/)
    .map(sinAcentos)
    .filter((w) => w.length >= MIN_LETRAS_COGNADO);
}

/** Qué tanto se parecen dos textos ya normalizados, de 0 a 1. */
function parecido(a: string, b: string): number {
  const largo = Math.max(a.length, b.length);
  return largo === 0 ? 1 : 1 - levenshtein(a, b) / largo;
}

/** ¿Alguna palabra de una lista se ve como una de la otra? Las listas ya vienen de `palabrasLargas`. */
function hayCognado(en: readonly string[], es: readonly string[]): boolean {
  for (const a of en) {
    for (const b of es) {
      if (a.charCodeAt(0) !== b.charCodeAt(0)) continue;
      // La distancia nunca es menor que la diferencia de largo: si esa sola ya baja del umbral, no hace falta calcularla.
      const largo = Math.max(a.length, b.length);
      const dif = Math.abs(a.length - b.length);
      if (dif > MAX_DIFERENCIA_LETRAS || dif > (1 - UMBRAL_COGNADO) * largo) continue;
      if (parecido(a, b) >= UMBRAL_COGNADO) return true;
    }
  }
  return false;
}

/** ¿Alguna palabra del texto en español se ve como una de la frase en inglés? (`UMBRAL_COGNADO`) */
export function tieneCognado(fraseEn: string, textoEs: string): boolean {
  return hayCognado(palabrasLargas(fraseEn), palabrasLargas(textoEs));
}

/** Lo que una opción en español trae que se puede notar de un vistazo. Dos opciones que no coinciden se distinguen. */
export interface Firma {
  digitos: boolean;
  palabras: boolean;
  nombre: boolean;
}

export function firmaDe(textoEs: string): Firma {
  return {
    digitos: tieneDigitos(textoEs),
    palabras: tienePalabraNumero(textoEs, 'es'),
    nombre: nombresPropios(textoEs).length > 0,
  };
}

export function mismaFirma(a: Firma, b: Firma): boolean {
  return a.digitos === b.digitos && a.palabras === b.palabras && a.nombre === b.nombre;
}

/** La firma como un número, para compararla con una sola resta al recorrer todo el catálogo. */
function codigoFirma(f: Firma): number {
  return (f.digitos ? 4 : 0) + (f.palabras ? 2 : 0) + (f.nombre ? 1 : 0);
}

/** Lo que la traducción correcta comparte con la frase en inglés: eso es lo que regala la respuesta. */
export interface Pistas {
  numero: boolean;
  nombre: boolean;
  cognado: boolean;
}

export function pistasDe(fraseEn: string, respuestaEs: string): Pistas {
  const numeroEn = tieneDigitos(fraseEn) || tienePalabraNumero(fraseEn, 'en');
  const numeroEs = tieneDigitos(respuestaEs) || tienePalabraNumero(respuestaEs, 'es');
  return {
    numero: numeroEn && numeroEs,
    nombre: nombresPropios(fraseEn).length > 0 && nombresPropios(respuestaEs).length > 0,
    cognado: tieneCognado(fraseEn, respuestaEs),
  };
}

export function regalaPista(p: Pistas): boolean {
  return p.numero || p.nombre || p.cognado;
}

/** El texto sin mayúsculas, acentos ni puntuación: para saber si dos traducciones son la misma. */
function limpiar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** `casiIgual` con los textos ya limpios (`ca` y `cb`), para no repetir la limpieza al comparar contra todo el pool. */
function casiIgualLimpios(a: string, ca: string, b: string, cb: string): boolean {
  const dif = Math.abs(ca.length - cb.length);
  // Solo si el largo es casi el mismo se paga la normalización de `mismoTexto` (la que usa Detalle).
  if (dif <= 2 && mismoTexto(a, b)) return true;
  // Si el largo ya difiere más de lo que deja el umbral, no pueden parecerse tanto: se evita la distancia.
  if (dif > (1 - UMBRAL_CASI_IGUAL) * Math.max(ca.length, cb.length)) return false;
  return parecido(ca, cb) >= UMBRAL_CASI_IGUAL;
}

/**
 * ¿Son la misma traducción o casi? Se compara con `mismoTexto` (la misma normalización que usa Detalle para no
 * mostrar dos veces una traducción) y, si no, por parecido (`UMBRAL_CASI_IGUAL`).
 */
export function casiIgual(a: string, b: string): boolean {
  return casiIgualLimpios(a, limpiar(a), b, limpiar(b));
}

/** Lo que hace falta saber de una entrada para usarla o para elegirle distractores. */
export interface EntradaDistractor {
  id: number;
  /** La frase en inglés. */
  phrase: string;
  /** Su traducción principal: lo que se muestra como opción. */
  spanish: string;
  wordCount: number;
  pack: string;
  mundo: string;
}

/** Una entrada lista para ser distractor: con su firma, su texto normalizado y sus palabras ya calculados una vez. */
export interface Candidato extends EntradaDistractor {
  firma: Firma;
  codigo: number;
  clave: string;
  palabras: string[];
}

export function prepararPool(entradas: readonly EntradaDistractor[]): Candidato[] {
  return entradas.map((e) => {
    const firma = firmaDe(e.spanish);
    return { ...e, firma, codigo: codigoFirma(firma), clave: limpiar(e.spanish), palabras: palabrasLargas(e.spanish) };
  });
}

/** 2 si es del mismo pack y de un tamaño parecido, 1 si es del mismo mundo, 0 si no. */
function cercania(a: EntradaDistractor, c: EntradaDistractor): number {
  if (c.pack === a.pack && Math.abs(c.wordCount - a.wordCount) <= DIFERENCIA_PALABRAS) return 2;
  return c.mundo === a.mundo ? 1 : 0;
}

/**
 * Elige los `cuantos` distractores de una entrada. Nunca sale una traducción igual o casi igual a la correcta ni
 * dos iguales entre sí. Entre las demás, manda este orden (el primero que no se puede cumplir es el que cede):
 *
 *  1. Misma firma que la correcta: si la correcta trae un número o un nombre propio, las falsas también; si no lo
 *     trae, ninguna. Así ese elemento no delata cuál es.
 *  2. Que no estén en `usados` (los de las tarjetas anteriores de la sesión): solo se repiten si ya no hay otras.
 *  3. Si la correcta comparte un cognado con la frase, mejor las que también lo comparten (las hay pocas: es lo que
 *     se puede hacer, porque el cognado de la correcta no se puede quitar).
 *  4. Cercanía de pack y de tamaño, para que la larga no se distinga de las cortas.
 *
 * `usados` son textos de opción (`spanish`). `azar` desempata y se puede fijar en las pruebas.
 */
export function elegirDistractores(
  entrada: EntradaDistractor,
  pool: readonly Candidato[],
  cuantos: number,
  usados: ReadonlySet<string> = new Set(),
  azar: () => number = Math.random
): string[] {
  const codigo = codigoFirma(firmaDe(entrada.spanish));
  const palabrasEn = palabrasLargas(entrada.phrase);
  const conCognado = hayCognado(palabrasEn, palabrasLargas(entrada.spanish));
  const claveEntrada = limpiar(entrada.spanish);

  // Cada candidato cae en una de 24 cubetas (firma × sin usar × cognado × cercanía) y se elige de la mejor hacia
  // abajo: no hace falta ordenar todo el catálogo para sacar tres. Dentro de una cubeta se saca al azar.
  const cubetas: Candidato[][] = Array.from({ length: 2 * 2 * 2 * 3 }, () => []);
  for (const c of pool) {
    if (c.id === entrada.id) continue;
    const clase =
      ((c.codigo === codigo ? 2 : 0) + (usados.has(c.spanish) ? 0 : 1)) * 2 +
      (conCognado && hayCognado(palabrasEn, c.palabras) ? 1 : 0);
    cubetas[clase * 3 + cercania(entrada, c)]?.push(c);
  }

  const elegidas: Candidato[] = [];
  for (let b = cubetas.length - 1; b >= 0 && elegidas.length < cuantos; b--) {
    const lista = cubetas[b] ?? [];
    while (lista.length > 0 && elegidas.length < cuantos) {
      const j = Math.floor(azar() * lista.length);
      const c = lista[j] as Candidato;
      lista[j] = lista[lista.length - 1] as Candidato;
      lista.pop();
      // La comparación de traducciones solo se paga con los que se van a elegir: la misma traducción que la
      // correcta, o una que se parece a otra ya elegida, cuenta como repetida y se salta.
      if (casiIgualLimpios(entrada.spanish, claveEntrada, c.spanish, c.clave)) continue;
      if (elegidas.some((e) => casiIgualLimpios(e.spanish, e.clave, c.spanish, c.clave))) continue;
      elegidas.push(c);
    }
  }
  return elegidas.map((c) => c.spanish);
}
