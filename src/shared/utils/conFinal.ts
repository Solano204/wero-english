/**
 * `try { cuerpo } finally { alFinal }` como función. El React Compiler 1.0 todavía no compila `finally`: un hook o
 * componente que lo trae se queda sin optimizar entero. Con esto, el `finally` vive fuera del componente y el
 * comportamiento es el mismo (alFinal corre siempre, y el error o el valor de `cuerpo` siguen su camino).
 */
export function conFinal<T>(cuerpo: () => T, alFinal: () => void): T {
  try {
    return cuerpo();
  } finally {
    alFinal();
  }
}

export async function conFinalAsync<T>(cuerpo: () => Promise<T>, alFinal: () => void): Promise<T> {
  try {
    return await cuerpo();
  } finally {
    alFinal();
  }
}
