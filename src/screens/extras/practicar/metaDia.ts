import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'wero:meta-celebrada';

/**
 * true solo la primera vez que se pide en un día para ese usuario: el anillo
 * suelta su destello una vez por día. Vive en AsyncStorage y no en la base:
 * es un adorno, no progreso. Si el almacenamiento falla, no celebra.
 */
export async function celebrarSiToca(usuarioId: number, dia: string): Promise<boolean> {
  const clave = `${CLAVE}:${usuarioId}`;
  try {
    if ((await AsyncStorage.getItem(clave)) === dia) return false;
    await AsyncStorage.setItem(clave, dia);
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[practicar] no se pudo guardar el día de la meta', error);
    return false;
  }
}
