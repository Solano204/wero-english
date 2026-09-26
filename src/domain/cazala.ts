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

/** Una reducción de la ronda, lista para señalarla en la frase y transformarla en su forma completa. */
export interface ReduccionCaza {
  id: number;
  /** Como suena en la frase: «chillin'». */
  reducida: string;
  /** Su forma completa tal como está en `frase_formal` («chilling»); null si no se puede señalar ahí. */
  completa: string | null;
  /** Cómo suena, en las que no tienen forma completa (little → «lirol»); null en las demás. */
  suena: string | null;
  /** Primera y última palabra de `frase_real` que ocupa (índices de `trocear`); null si no se encuentra. */
  rango: [number, number] | null;
}

/** La palabra como la compara Cázala: minúsculas, apóstrofo recto y sin la puntuación de los bordes. */
function limpia(palabra: string): string {
  return palabra
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
}

/** Palabras sueltas y rodeadas de espacios, para buscar una frase entera sin partir palabras. */
function rodeada(texto: string): string {
  return ` ${texto.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim()} `;
}

/** Dónde está la reducción dentro de la frase que suena: de la primera a la última palabra que ocupa. */
export function rangoEnFrase(frase: string, reducida: string): [number, number] | null {
  const tokens = frase.trim().split(/\s+/).map(limpia);
  const buscada = reducida.trim().split(/\s+/).map(limpia).filter(Boolean);
  if (buscada.length === 0) return null;
  for (let i = 0; i + buscada.length <= tokens.length; i++) {
    if (buscada.every((b, k) => tokens[i + k] === b)) return [i, i + buscada.length - 1];
  }
  return null;
}

/**
 * La forma completa que de verdad aparece en `frase_formal`. `phrase_alt` puede traer varias opciones
 * («got to / have got to»): se toma la más larga que está en la frase; si ninguna, null.
 */
export function formaCompleta(fraseFormal: string, phraseAlt: string | null): string | null {
  if (!phraseAlt) return null;
  const formal = rodeada(fraseFormal);
  const dentro = phraseAlt
    .split('/')
    .map((o) => o.trim())
    .filter((o) => o !== '' && formal.includes(rodeada(o)));
  return dentro.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * Las tres reducciones de una ronda, en el orden en que suenan. Las de «suena» (`phrase` con →) no tienen
 * forma completa: su `phrase_alt` es cómo se oyen, no algo a lo que se transformen.
 */
export function reduccionesDe(item: CazalaItem, porId: Map<number, Entry>): ReduccionCaza[] {
  const lista = item.reducciones.flatMap((id): ReduccionCaza[] => {
    const e = porId.get(id);
    if (!e) return [];
    const suena = e.phrase.includes('→') ? e.phrase_alt : null;
    return [
      {
        id,
        reducida: e.phrase_tts,
        completa: suena ? null : formaCompleta(item.frase_formal, e.phrase_alt),
        suena,
        rango: rangoEnFrase(item.frase_real, e.phrase_tts),
      },
    ];
  });
  return lista.sort((a, b) => (a.rango?.[0] ?? Infinity) - (b.rango?.[0] ?? Infinity));
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
