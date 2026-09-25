import AsyncStorage from '@react-native-async-storage/async-storage';

/** Qué se celebra: la meta del día, el reto de la semana o un récord de racha. */
export type TemaCelebracion = 'meta' | 'reto' | 'record';

/**
 * true solo la primera vez que se pide para esa `marca` (el día o el lunes de la
 * semana) y ese usuario: el destello sale una vez por día o por semana. Vive en
 * AsyncStorage y no en la base: es un adorno, no progreso. Si el almacenamiento
 * falla, no celebra.
 */
export async function celebrarSiToca(usuarioId: number, tema: TemaCelebracion, marca: string): Promise<boolean> {
  const clave = `wero:${tema}-celebrada:${usuarioId}`;
  try {
    if ((await AsyncStorage.getItem(clave)) === marca) return false;
    await AsyncStorage.setItem(clave, marca);
    return true;
  } catch (error) {
    if (__DEV__) console.warn(`[practicar] no se pudo guardar la celebración de ${tema}`, error);
    return false;
  }
}
