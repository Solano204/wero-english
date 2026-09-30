import { shuffle } from '@/utils/array';
import { levenshtein, normalizeAnswer } from '@/utils/text';
import type { AlternativaVoz, Fonema, HablaVeredicto, ParMinimoRound } from '@/types';

/**
 * Pares mínimos con micrófono.
 *
 * Esta es la única forma honesta de usar un reconocedor de voz general
 * para enseñar pronunciación. El reconocedor devuelve texto, no una
 * calificación de fonemas: no puede decirte si tu acento es bueno. Lo
 * que sí puede, y con buena precisión, es decir si dijiste "beach" o
 * dijiste "bitch".
 *
 * Por eso el ejercicio es binario. No se muestra ningún puntaje, no se
 * inventa un porcentaje a partir de la confianza del reconocedor, y no
 * se bloquea nada si el teléfono no entendió.
 */

export const RONDAS_POR_PARTIDA = 15;

export function buildRounds(
  fonemas: Fonema[],
  total: number = RONDAS_POR_PARTIDA
): ParMinimoRound[] {
  const todos: ParMinimoRound[] = [];

  for (const f of fonemas) {
    f.pares_minimos.forEach((par, i) => {
      // Se pregunta por el lado A y el B se usa como juez. Si la palabra
      // A no trae audio no se puede dar el modelo, y sin modelo el
      // ejercicio es adivinar.
      if (!par.a || !par.b) return;
      todos.push({
        id: `${f.id}:${i}`,
        objetivo: par.a,
        objetivoIpa: par.a_ipa,
        objetivoEs: par.a_es,
        confusa: par.b,
        confusaEs: par.b_es,
        audioObjetivo: par.audio_a,
        fonema: f.nombre,
        elErrorTipico: f.el_error_tipico,
      });
    });
  }

  return shuffle(todos).slice(0, total);
}

/** Las variantes por par de assets/data/confusiones_voz.json (`ConfusionesVozFile.pares`). */
export type VariantesPorPar = Record<string, Record<string, string[]>>;

/**
 * Cómo se usan las varias alternativas del reconocedor.
 *
 * - `primera_decisiva` (la que se usa): se recorren en orden y decide la primera que se parece a una de las dos
 *   palabras. Si la 1.ª es ruido («chip it») y la 2.ª es «ship», es acierto; pero si la 1.ª es la confusa, gana la
 *   confusa aunque más abajo aparezca la buena. Al reconocedor se le pasan las DOS palabras como pistas
 *   (contextualStrings), así que es normal que la otra aparezca de 2.ª o 3.ª opción aunque se haya dicho clarito
 *   la primera: con «cualquiera», casi todo intento saldría acierto y el ejercicio dejaría de enseñar.
 * - `cualquiera`: acierto si CUALQUIER alternativa trae la palabra buena; confusa solo si ninguna la trae.
 */
export type CriterioAlternativas = 'primera_decisiva' | 'cualquiera';
export const CRITERIO_ALTERNATIVAS: CriterioAlternativas = 'primera_decisiva';

/** Solo en palabras de este largo o más se perdona una letra (en «cat» una letra es otra palabra). */
const LARGO_MINIMO_TOLERANCIA = 4;

type Lado = 'objetivo' | 'confusa' | null;

/** Clave de un par en confusiones_voz.json: las dos palabras en minúsculas, en orden alfabético. */
export function clavePar(a: string, b: string): string {
  return [normalizeAnswer(a), normalizeAnswer(b)].sort().join('|');
}

/** Formas simples de una palabra que el reconocedor escribe por ella: plural y posesivo. */
export function formasSimples(palabra: string): Set<string> {
  const f = new Set([palabra, `${palabra}s`, `${palabra}es`, `${palabra}'s`]);
  if (/[^aeiou]y$/.test(palabra)) f.add(`${palabra.slice(0, -1)}ies`);
  return f;
}

interface Juez {
  objetivo: string;
  confusa: string;
  formasObjetivo: Set<string>;
  formasConfusa: Set<string>;
  variantesObjetivo: Set<string>;
  variantesConfusa: Set<string>;
}

function armarJuez(round: ParMinimoRound, variantes?: VariantesPorPar): Juez {
  const objetivo = normalizeAnswer(round.objetivo);
  const confusa = normalizeAnswer(round.confusa);
  const delPar = variantes?.[clavePar(objetivo, confusa)] ?? {};
  const limpiar = (lista: string[] | undefined) => new Set((lista ?? []).map(normalizeAnswer));
  const formasObjetivo = formasSimples(objetivo);
  const formasConfusa = formasSimples(confusa);
  // Una forma que es de las dos (o que ES la otra palabra) no decide nada: «a menos que la otra palabra del par
  // sea justo esa forma».
  for (const f of [...formasObjetivo]) {
    if (formasConfusa.has(f)) {
      formasObjetivo.delete(f);
      formasConfusa.delete(f);
    }
  }
  formasObjetivo.delete(confusa);
  formasConfusa.delete(objetivo);
  return {
    objetivo,
    confusa,
    formasObjetivo,
    formasConfusa,
    variantesObjetivo: limpiar(delPar[objetivo]),
    variantesConfusa: limpiar(delPar[confusa]),
  };
}

/**
 * A cuál de las dos palabras se parece UNA alternativa. Se revisa por niveles, del más al menos seguro, y en cada
 * nivel la buena va primero (si una frase trae las dos, se le da el punto a quien habla, como siempre):
 *   1. la palabra exacta;
 *   2. su plural o posesivo, o una palabra que suena exactamente igual (tabla por par);
 *   3. una letra de diferencia, solo en palabras de 4 letras o más y solo si NO queda a una letra de la otra.
 */
function clasificar(texto: string, j: Juez): Lado {
  const limpio = normalizeAnswer(texto);
  if (limpio.length === 0) return null;
  const tokens = limpio.split(' ');
  const con = (conjunto: Set<string>) => tokens.some((t) => conjunto.has(t));

  // Palabras de más de una (por si algún par las trae): se busca la frase completa.
  const contiene = (palabra: string) =>
    palabra.includes(' ') ? ` ${limpio} `.includes(` ${palabra} `) : tokens.includes(palabra);

  if (contiene(j.objetivo)) return 'objetivo';
  if (contiene(j.confusa)) return 'confusa';

  if (con(j.formasObjetivo) || con(j.variantesObjetivo)) return 'objetivo';
  if (con(j.formasConfusa) || con(j.variantesConfusa)) return 'confusa';

  const cerca = (t: string, palabra: string) => palabra.length >= LARGO_MINIMO_TOLERANCIA && levenshtein(t, palabra) <= 1;
  if (tokens.some((t) => cerca(t, j.objetivo) && levenshtein(t, j.confusa) > 1)) return 'objetivo';
  if (tokens.some((t) => cerca(t, j.confusa) && levenshtein(t, j.objetivo) > 1)) return 'confusa';
  return null;
}

/**
 * Interpreta lo que devolvió el reconocedor: todas sus alternativas (o una sola transcripción, o null si no oyó).
 *
 * `no_entendi` (silencio, ruido o algo que no se parece a ninguna de las dos) no es un error de quien habla: la
 * pantalla pide repetir y no lo cuenta.
 */
export function juzgar(
  round: ParMinimoRound,
  oido: readonly AlternativaVoz[] | string | null,
  variantes?: VariantesPorPar,
  criterio: CriterioAlternativas = CRITERIO_ALTERNATIVAS
): HablaVeredicto {
  const alternativas: AlternativaVoz[] =
    oido === null
      ? []
      : typeof oido === 'string'
        ? oido.trim().length > 0
          ? [{ texto: oido.trim(), confianza: null }]
          : []
        : oido.filter((a) => a.texto.trim().length > 0);

  const j = armarJuez(round, variantes);
  const lados = alternativas.map((a) => clasificar(a.texto, j));

  if (criterio === 'cualquiera') {
    const buena = lados.indexOf('objetivo');
    if (buena >= 0) return { tipo: 'acierto', oido: alternativas[buena]!.texto, alternativas };
    const mala = lados.indexOf('confusa');
    if (mala >= 0) return { tipo: 'confusa', oido: alternativas[mala]!.texto, alternativas };
  } else {
    const i = lados.findIndex((l) => l !== null);
    if (i >= 0) {
      const texto = alternativas[i]!.texto;
      return lados[i] === 'objetivo'
        ? { tipo: 'acierto', oido: texto, alternativas }
        : { tipo: 'confusa', oido: texto, alternativas };
    }
  }
  return { tipo: 'no_entendi', oido: alternativas[0]?.texto ?? null, alternativas };
}

/** El texto que se le muestra al usuario según el veredicto. */
export function explicar(
  round: ParMinimoRound,
  v: HablaVeredicto
): { titulo: string; cuerpo: string } {
  switch (v.tipo) {
    case 'acierto':
      return {
        titulo: 'Se entendió',
        cuerpo: `Wero oyó "${round.objetivo}". Eso es lo que querías decir.`,
      };
    case 'confusa':
      return {
        titulo: `Oyó "${round.confusa}"`,
        cuerpo: `${round.confusaEs}, no ${round.objetivoEs}. ${round.elErrorTipico}`,
      };
    case 'no_entendi':
      return {
        titulo: 'No alcancé a oírte bien',
        cuerpo: 'Intenta otra vez. Esto no cuenta como error.',
      };
    case 'no_disponible':
      return {
        titulo: 'El micrófono no está disponible',
        cuerpo: v.razon,
      };
  }
}
