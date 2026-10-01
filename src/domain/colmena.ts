import { shuffle } from '@/domain/arreglos';
import type { ColmenaRound, Entry } from '@/types';

/**
 * Colmena: se muestra el español y el usuario arma la palabra inglesa
 * letra por letra.
 *
 * Es el ejercicio de producción más fuerte que hay en la app disfrazado
 * de juego: exige recordar la ortografía completa, igual que Escribir,
 * pero sin teclado y sin castigar un dedo torpe. Por eso califica como
 * producción en applyGameGrade.
 *
 * Todo el contenido sale de completar_palabra, que ya existe en el
 * catálogo. Cero contenido nuevo.
 */

export const RONDAS_POR_PARTIDA = 15;

/** Cuántas letras de sobra se meten además de las de la palabra. */
export const SENUELOS_DEFECTO = 3;

const VOCALES = 'aeiou';
const CONSONANTES = 'bcdfghklmnprstwy';

export function buildRounds(
  pool: Entry[],
  total: number = RONDAS_POR_PARTIDA,
  senuelos: number = SENUELOS_DEFECTO
): ColmenaRound[] {
  const usables = pool.filter(esUsable);
  const elegidas = shuffle(usables).slice(0, total);
  return elegidas.map((e) => toRound(e, senuelos));
}

function esUsable(e: Entry): boolean {
  // Ahora se arma la frase completa en inglés, no una palabra suelta.
  // El tope de 22 letras no es capricho: arriba de eso la cuadrícula
  // deja de caber y las letras se vuelven ilegibles en un teléfono chico.
  const limpia = normaliza(e.phrase_tts);
  return limpia.length >= 4 && limpia.length <= 22;
}

function toRound(entry: Entry, senuelos: number): ColmenaRound {
  const objetivo = normaliza(entry.phrase_tts);
  const letras = shuffle([
    ...objetivo.split(''),
    ...senuelosPara(objetivo, senuelos),
  ]);

  return {
    entry,
    objetivo,
    pista: entry.spanish_main,
    letras,
  };
}

/**
 * Las letras de sobra imitan el perfil de la palabra: si la palabra
 * tiene muchas vocales, los señuelos también. Señuelos al azar puro
 * delatan cuáles son las buenas por pura estadística.
 */
function senuelosPara(objetivo: string, cuantos: number): string[] {
  const vocales = [...objetivo].filter((c) => VOCALES.includes(c)).length;
  const proporcionVocal = vocales / Math.max(1, objetivo.length);

  const out: string[] = [];
  for (let i = 0; i < cuantos; i++) {
    const fuente = Math.random() < proporcionVocal ? VOCALES : CONSONANTES;
    const c = fuente[Math.floor(Math.random() * fuente.length)] ?? 'e';
    out.push(c);
  }
  return out;
}

/**
 * Deja solo letras y apóstrofos, sin espacios.
 *
 * Los espacios se quitan del objetivo porque nadie va a tocar una ficha
 * de espacio: la frase se arma pegada y la pantalla la muestra separada
 * por palabras cuando ya está completa.
 */
export function normaliza(texto: string): string {
  return texto.trim().toLowerCase().replace(/[^a-z']/g, '');
}

/**
 * Da la primera letra que falta.
 *
 * Nunca resuelve la palabra: si la pista terminara el ejercicio dejaría
 * de ser un empujón y sería la respuesta.
 */
export function pistaPara(objetivo: string, armado: string): string | null {
  if (armado.length >= objetivo.length) return null;
  return objetivo[armado.length] ?? null;
}

/** ¿Lo armado hasta ahora sigue siendo un prefijo válido? */
export function vaBien(objetivo: string, armado: string): boolean {
  return objetivo.startsWith(armado);
}

export function estaCompleta(objetivo: string, armado: string): boolean {
  return objetivo === armado;
}
