/**
 * Comparación letra por letra entre lo que se escribió y lo esperado (Dictado y
 * Escribir). Módulo puro: se prueba con `npm run check:estudio`.
 */

export type TipoTramo = 'igual' | 'extra' | 'falta';

export interface Tramo {
  texto: string;
  /** igual: bien escrito. extra: lo escribiste y sobra. falta: lo esperado y no está. */
  tipo: TipoTramo;
}

/** Forma comparable de una letra: sin mayúsculas ni acentos, con un solo apóstrofo. */
function clave(letra: string): string {
  return letra
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");
}

/**
 * La frase esperada con lo que salió mal marcado en su lugar: los tramos `igual`
 * (en la forma esperada, con su mayúscula), lo que `falta` y lo que sobra (`extra`).
 * No distingue mayúsculas ni acentos, igual que la calificación (`isCloseEnough`).
 * Subsecuencia común más larga: las frases caben de sobra (unos cientos de letras).
 */
export function diffLetras(dado: string, esperado: string): Tramo[] {
  const a = Array.from(dado);
  const b = Array.from(esperado);
  const ka = a.map(clave);
  const kb = b.map(clave);
  const ancho = b.length + 1;
  const dp = new Array<number>((a.length + 1) * ancho).fill(0);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i * ancho + j] =
        ka[i] === kb[j]
          ? (dp[(i + 1) * ancho + j + 1] ?? 0) + 1
          : Math.max(dp[(i + 1) * ancho + j] ?? 0, dp[i * ancho + j + 1] ?? 0);
    }
  }

  const tramos: Tramo[] = [];
  const anota = (texto: string, tipo: TipoTramo) => {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.tipo === tipo) tramos[tramos.length - 1] = { texto: ultimo.texto + texto, tipo };
    else tramos.push({ texto, tipo });
  };

  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && ka[i] === kb[j]) {
      anota(b[j] ?? '', 'igual');
      i++;
      j++;
    } else if (j >= b.length || (i < a.length && (dp[(i + 1) * ancho + j] ?? 0) >= (dp[i * ancho + j + 1] ?? 0))) {
      anota(a[i] ?? '', 'extra');
      i++;
    } else {
      anota(b[j] ?? '', 'falta');
      j++;
    }
  }
  return tramos;
}
