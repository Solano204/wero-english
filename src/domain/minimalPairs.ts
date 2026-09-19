import { shuffle } from '@/utils/array';
import { normalizeAnswer } from '@/utils/text';
import type { Fonema, HablaVeredicto, ParMinimoRound } from '@/types';

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

/**
 * Interpreta lo que devolvió el reconocedor.
 *
 * El orden de las comprobaciones importa: primero el objetivo, luego la
 * confusa, y solo al final "otra cosa". Si se revisara al revés, una
 * transcripción que contiene las dos palabras se calificaría mal.
 */
export function juzgar(
  round: ParMinimoRound,
  transcripcion: string | null
): HablaVeredicto {
  if (transcripcion === null) return { tipo: 'silencio' };

  const oido = transcripcion.trim();
  if (oido.length === 0) return { tipo: 'silencio' };

  const limpio = normalizeAnswer(oido);
  const objetivo = normalizeAnswer(round.objetivo);
  const confusa = normalizeAnswer(round.confusa);

  if (contienePalabra(limpio, objetivo)) return { tipo: 'acierto', oido };
  if (contienePalabra(limpio, confusa)) return { tipo: 'confusa', oido };

  return { tipo: 'otra_cosa', oido };
}

/**
 * El reconocedor a veces devuelve una frase entera por una palabra
 * suelta ("beach please"). Se busca la palabra dentro, no igualdad
 * exacta, o se estarían marcando como error intentos correctos.
 */
function contienePalabra(texto: string, palabra: string): boolean {
  if (texto === palabra) return true;
  return texto.split(' ').includes(palabra);
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
    case 'otra_cosa':
      return {
        titulo: 'No fue ninguna de las dos',
        cuerpo: `Oyó "${v.oido}". Escucha el modelo otra vez y repite pegado a él.`,
      };
    case 'silencio':
      return {
        titulo: 'No se oyó nada',
        cuerpo: 'Revisa que no tengas tapado el micrófono y vuelve a intentar.',
      };
    case 'no_disponible':
      return {
        titulo: 'El micrófono no está disponible',
        cuerpo: v.razon,
      };
  }
}
