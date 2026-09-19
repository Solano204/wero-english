import type { CardState, Entry, Lectura } from '@/types';

/**
 * Las lecturas.
 *
 * La diferencia con la biblioteca de la competencia está en el número de
 * dificultad. Ellos publican uno fijo, decidido por el editor. Aquí se
 * calcula por usuario: cuenta cuántas frases de la historia ya domina y
 * pondera las que no por su nivel.
 *
 * Eso lo vuelve honesto en los dos sentidos. Una historia que hoy dice
 * 54 va a decir 30 el mes que entra, y esa bajada es la prueba más
 * directa de progreso que la app puede enseñar. Un número fijo, en
 * cambio, es una afirmación con la que el usuario va a estar en
 * desacuerdo la primera vez que una historia marcada como difícil le
 * resulte fácil.
 */

export interface EstadoLectura {
  /** 0 a 100. Baja sola conforme el usuario aprende. */
  dificultad: number;
  /** Cuántas de las frases de la historia ya domina. */
  dominadas: number;
  /** Cuántas nunca ha visto. Son las que salen en ámbar. */
  nuevas: number;
  total: number;
  abierta: boolean;
  /** Cuánto le falta para abrirla, si está cerrada. */
  faltan: number;
}

/**
 * Calcula la dificultad de una historia para este usuario.
 *
 * Peso por frase: 0 si la domina, 1 si la ha visto, y nivel (1 a 3) si
 * nunca la ha visto. Una frase de nivel 3 desconocida pesa el triple que
 * una de nivel 1, porque eso es exactamente lo que se siente al leer.
 */
export function dificultadPara(
  lectura: Lectura,
  entradas: Map<number, Entry>,
  estados: Map<number, CardState>
): EstadoLectura {
  let peso = 0;
  let maximo = 0;
  let dominadas = 0;
  let nuevas = 0;

  for (const id of lectura.frases) {
    const entry = entradas.get(id);
    const nivel = entry?.nivel ?? 2;
    maximo += nivel;

    const st = estados.get(id);
    if (!st) {
      peso += nivel;
      nuevas++;
      continue;
    }
    if (st.dominada === 1) {
      dominadas++;
      continue;
    }
    peso += 1;
  }

  const dificultad =
    maximo === 0 ? 0 : Math.round((peso / maximo) * 100);

  return {
    dificultad,
    dominadas,
    nuevas,
    total: lectura.frases.length,
    abierta: true,
    faltan: 0,
  };
}

/**
 * ¿Está abierta? Una lectura se abre por trabajo ya hecho, nunca por
 * dinero ni por ver un anuncio. Y se muestra cerrada, no escondida:
 * "llevas 11 de 15" es una razón para hacer otra sesión, una historia
 * invisible no es nada.
 */
export function estadoDesbloqueo(
  lectura: Lectura,
  dominadasPorMundo: Record<string, number>
): { abierta: boolean; faltan: number } {
  if (!lectura.desbloquea) return { abierta: true, faltan: 0 };
  const tiene = dominadasPorMundo[lectura.desbloquea.mundo] ?? 0;
  const faltan = Math.max(0, lectura.desbloquea.dominadas - tiene);
  return { abierta: faltan === 0, faltan };
}

export interface Trozo {
  texto: string;
  /** Id de la entrada si este trozo es una frase del catálogo. */
  entryId: number | null;
  /** true si el usuario nunca la ha visto: se pinta en ámbar. */
  nueva: boolean;
}

/**
 * Parte el texto del capítulo en trozos, marcando las frases del
 * catálogo.
 *
 * Se busca en tiempo de ejecución en vez de guardar posiciones en el
 * JSON. Guardar posiciones significa que corregir una errata en el
 * texto desalinea todos los subrayados de ese capítulo, y nadie se da
 * cuenta hasta que un usuario toca una palabra y se abre otra ficha.
 *
 * Las frases largas se buscan primero: si "I have to draw a line" y
 * "a line" estuvieran las dos en el catálogo, buscar la corta primero
 * partiría la larga a la mitad.
 */
export function partirTexto(
  texto: string,
  frases: { id: number; phrase: string; nueva: boolean }[]
): Trozo[] {
  const ordenadas = [...frases].sort(
    (a, b) => b.phrase.length - a.phrase.length
  );

  let trozos: Trozo[] = [{ texto, entryId: null, nueva: false }];

  for (const f of ordenadas) {
    const siguiente: Trozo[] = [];

    for (const t of trozos) {
      if (t.entryId !== null) {
        siguiente.push(t);
        continue;
      }
      siguiente.push(...partirUno(t.texto, f));
    }

    trozos = siguiente;
  }

  return trozos.filter((t) => t.texto.length > 0);
}

function partirUno(
  texto: string,
  f: { id: number; phrase: string; nueva: boolean }
): Trozo[] {
  const bajo = texto.toLowerCase();
  const objetivo = f.phrase.toLowerCase();
  const at = bajo.indexOf(objetivo);
  if (at < 0) return [{ texto, entryId: null, nueva: false }];

  const antes = texto.slice(0, at);
  const medio = texto.slice(at, at + f.phrase.length);
  const despues = texto.slice(at + f.phrase.length);

  return [
    { texto: antes, entryId: null, nueva: false },
    { texto: medio, entryId: f.id, nueva: f.nueva },
    // El resto se vuelve a revisar por si la frase aparece dos veces.
    ...partirUno(despues, f),
  ];
}

/** Etiqueta corta para la lista. */
export function etiquetaDificultad(d: number): string {
  if (d <= 25) return 'fácil para ti';
  if (d <= 55) return 'te va a costar tantito';
  return 'todavía pesada';
}
