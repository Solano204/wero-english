import type { CazalaItem, Entry } from '@/types';

/**
 * Cázala: suena una frase y hay que marcar las tres reducciones que
 * traía. El juego solo tiene sentido si esas tres reducciones están
 * de verdad en `frase_real` (si no, es imposible "cazarlas" de oído) y
 * si ningún distractor aparece ahí también (si no, la respuesta
 * correcta tendría más de tres opciones válidas).
 *
 * Esta validación se comparte entre `scripts/valida-cazala.mjs` (que
 * reimplementa la misma lógica en JS plano, porque los scripts de Node
 * de este repo no compilan TypeScript) y esta pantalla, que la usa
 * para no dejar pasar un item roto a producción.
 */

/** Unifica apóstrofos tipográficos (’) con el recto (') antes de comparar. */
function normaliza(s: string): string {
  return s.toLowerCase().replace(/[’‘]/g, "'").trim();
}

/**
 * Lista de errores de un item (vacía = válido).
 *
 * `porId` debe traer, como mínimo, las entradas de `item.opciones`
 * (unión de reducciones y distractores).
 */
export function erroresCazalaItem(
  item: CazalaItem,
  porId: Map<number, Entry>
): string[] {
  const errores: string[] = [];
  const frase = normaliza(item.frase_real);

  if (item.reducciones.length !== 3) {
    errores.push(`reducciones debe tener 3, tiene ${item.reducciones.length}`);
  }
  if (item.distractores.length !== 3) {
    errores.push(`distractores debe tener 3, tiene ${item.distractores.length}`);
  }

  const todas = [...item.reducciones, ...item.distractores];
  if (new Set(todas).size !== todas.length) {
    errores.push('reducciones y distractores tienen ids repetidos');
  }
  const esperadas = [...todas].sort((a, b) => a - b);
  const actuales = [...item.opciones].sort((a, b) => a - b);
  if (JSON.stringify(esperadas) !== JSON.stringify(actuales)) {
    errores.push('opciones no es exactamente reducciones ∪ distractores');
  }

  for (const id of item.reducciones) {
    const e = porId.get(id);
    if (!e) {
      errores.push(`reducción ${id} no existe en el catálogo`);
      continue;
    }
    // Las reglas del grupo "aave" (cópula cero, 'be' habitual, triple
    // negación, etc.) son un ejemplo de oración fijo, no una palabra
    // suelta que se pueda reconocer de oído dentro de OTRA frase: nunca
    // sirven como reducción a cazar.
    if (e.regla_grupo === 'aave') {
      errores.push(
        `reducción ${id} (${e.phrase_tts}) es una regla gramatical, no se puede cazar`
      );
      continue;
    }
    if (!frase.includes(normaliza(e.phrase_tts))) {
      errores.push(`reducción ${id} (${e.phrase_tts}) no aparece en frase_real`);
    }
  }

  for (const id of item.distractores) {
    const e = porId.get(id);
    if (!e) {
      errores.push(`distractor ${id} no existe en el catálogo`);
      continue;
    }
    if (frase.includes(normaliza(e.phrase_tts))) {
      errores.push(`distractor ${id} (${e.phrase_tts}) sí aparece en frase_real`);
    }
  }

  return errores;
}

/** Atajo para filtrar una lista completa, descartando los que fallen. */
export function itemsCazalaValidos(
  items: CazalaItem[],
  porId: Map<number, Entry>,
  onInvalido?: (item: CazalaItem, errores: string[]) => void
): CazalaItem[] {
  return items.filter((item) => {
    const errores = erroresCazalaItem(item, porId);
    if (errores.length > 0) onInvalido?.(item, errores);
    return errores.length === 0;
  });
}
