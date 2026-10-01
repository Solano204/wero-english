import { useState } from 'react';

/**
 * El último valor no nulo que se vio. Para las hojas que, al irse, se llevan su contenido: cuando el valor pasa a
 * null (la hoja baja), se sigue pintando el anterior hasta que termine de salir.
 *
 * Se guarda en estado y se ajusta durante el render (el patrón de React para «recordar el anterior»), no en una ref:
 * leer refs en el render deja al componente fuera del React Compiler. `igual` dice cuándo dos valores son el mismo
 * (por defecto, la misma referencia); mientras sean iguales se devuelve el guardado, con identidad estable.
 */
export function useUltimo<T>(valor: T | null | undefined, igual: (a: T, b: T) => boolean = Object.is): T | null {
  const [ultimo, setUltimo] = useState<T | null>(valor ?? null);
  if (valor === null || valor === undefined) return ultimo;
  if (ultimo !== null && igual(valor, ultimo)) return ultimo;
  setUltimo(valor);
  return valor;
}
