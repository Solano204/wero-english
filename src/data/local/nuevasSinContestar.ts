import AsyncStorage from '@react-native-async-storage/async-storage';

/** Dónde se guardan, por usuario, las nuevas que la última sesión mostró y no se contestaron. */
const claveSinContestar = (usuarioId: number) => `wero:nuevas-sin-contestar:${usuarioId}`;

export async function leerSinContestar(usuarioId: number): Promise<Set<number>> {
  try {
    const crudo = await AsyncStorage.getItem(claveSinContestar(usuarioId));
    const ids = crudo ? (JSON.parse(crudo) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is number => typeof x === 'number') : []);
  } catch {
    return new Set();
  }
}

export async function guardarSinContestar(usuarioId: number, ids: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(claveSinContestar(usuarioId), JSON.stringify(ids));
  } catch {
    // Sin esto la próxima sesión solo podría repetir alguna: no vale tumbar el cierre.
  }
}
