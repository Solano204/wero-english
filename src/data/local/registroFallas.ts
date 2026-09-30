import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Registro de errores en el teléfono: los últimos TOPE, nunca se manda a ningún lado (el aviso de privacidad dice que
 * no hay analítica). Va en AsyncStorage y no en SQLite a propósito: si lo que falla es la base, el registro sigue.
 */
const CLAVE = 'wero:registro-fallas';
export const TOPE_FALLAS = 50;
/** Una pila más larga se corta: con esto basta para ubicar el error. */
const TOPE_PILA = 2000;

export interface Falla {
  /** ISO 8601. */
  fecha: string;
  /** La pantalla que estaba abierta (nombre de la ruta), si se sabía. */
  pantalla: string | null;
  /** render (ErrorBoundary), global (error sin atrapar), promesa (rechazo sin atrapar) o el lugar que lo atrapó. */
  origen: string;
  mensaje: string;
  pila: string | null;
}

async function leer(): Promise<Falla[]> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE);
    const datos = crudo ? (JSON.parse(crudo) as unknown) : [];
    return Array.isArray(datos) ? (datos as Falla[]) : [];
  } catch {
    return [];
  }
}

// Las escrituras van en fila: dos errores casi juntos no se pisan.
let fila: Promise<void> = Promise.resolve();

export function anotarFalla(falla: Falla): Promise<void> {
  const recortada: Falla = { ...falla, pila: falla.pila ? falla.pila.slice(0, TOPE_PILA) : null };
  fila = fila.then(async () => {
    try {
      const actuales = await leer();
      const nuevas = [...actuales, recortada].slice(-TOPE_FALLAS);
      await AsyncStorage.setItem(CLAVE, JSON.stringify(nuevas));
    } catch {
      // Si ni esto se puede guardar, no hay dónde más anotarlo: no se tumba nada por el registro.
    }
  });
  return fila;
}

/** Las fallas guardadas, de la más vieja a la más nueva. */
export function leerFallas(): Promise<Falla[]> {
  return fila.then(leer);
}
