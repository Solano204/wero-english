import AsyncStorage from '@react-native-async-storage/async-storage';
import { initProgress } from '@/data/repos/progreso';
import { saveSetting } from '@/data/repos/ajustes';
import { packsSoloSuyos, vaciarTablasDelUsuario } from '@/data/repos/borrado';
import { borrarUsuario, renovarSemilla } from '@/data/repos/usuarios';
import { olvidarSemilla } from '@/data/semilla/semillaAleatoria';
import * as downloads from '@/services/descargas';
import * as consentimiento from './consentimiento';
import { continuarSinCuenta, signOut } from './auth';
import type { User } from '@/types';

/**
 * Borrar datos del teléfono, en serio: no hay servidor, así que lo que se borra aquí no queda en
 * ningún lado. Dos flujos (Ajustes, sección Legal):
 *
 *  - borrarCuenta: el usuario y TODO lo suyo, sus consentimientos y la sesión.
 *  - borrarMisDatos: todo el avance, pero la persona sigue con su sesión (con Google o con usuario
 *    y contraseña). Sin cuenta, el perfil local completo se va y se empieza uno nuevo.
 *
 * El SQL vive en data/repos/borrado.ts.
 */

/** Marcas por usuario que viven en AsyncStorage y no en la base (ver practicar/celebracion.ts). */
const CELEBRACIONES = ['meta', 'reto', 'record'] as const;

/** Borra el avance y todo lo que cuelga del usuario, sin tocar la fila del usuario. */
async function vaciarUsuario(usuarioId: number): Promise<void> {
  for (const packId of await packsSoloSuyos(usuarioId)) {
    await downloads.deletePackMedia(usuarioId, packId);
  }
  await vaciarTablasDelUsuario(usuarioId);
  await AsyncStorage.multiRemove([
    ...CELEBRACIONES.map((t) => `wero:${t}-celebrada:${usuarioId}`),
    // Las nuevas que la última sesión de Estudiar dejó sin contestar (useSessionStore).
    `wero:nuevas-sin-contestar:${usuarioId}`,
  ]);
}

/** Tras un borrado de datos se vuelve a Practicar, no al onboarding: la persona ya lo conoce. */
async function empezarLimpio(usuarioId: number): Promise<void> {
  await initProgress(usuarioId);
  await saveSetting(usuarioId, 'onboardingHecho', true);
}

/**
 * La cuenta y TODO lo suyo: avance, racha, mazo, atoradas, niveles, lecturas, ajustes, registros
 * de packs (y sus archivos si nadie más los usa), sus marcas en AsyncStorage, los consentimientos
 * del teléfono y la sesión guardada. Quien llama cierra además la sesión de Google en la app.
 */
export async function borrarCuenta(usuarioId: number): Promise<void> {
  await vaciarUsuario(usuarioId);
  await borrarUsuario(usuarioId);
  olvidarSemilla(usuarioId);
  await consentimiento.borrarTodos();
  await signOut();
}

/**
 * Todo el avance, conservando la sesión. Con Google o con usuario y contraseña, es el mismo
 * usuario con el avance en ceros. Sin cuenta, el perfil local completo se borra y se crea uno
 * nuevo (devuelve ese usuario nuevo).
 */
export async function borrarMisDatos(usuario: User): Promise<User> {
  const sinCuenta = usuario.google_sub === null && usuario.username.startsWith('invitado_');
  if (sinCuenta) {
    await vaciarUsuario(usuario.id);
    await borrarUsuario(usuario.id);
    olvidarSemilla(usuario.id);
    const nuevo = await continuarSinCuenta({ nuevo: true });
    await empezarLimpio(nuevo.id);
    return nuevo;
  }
  await vaciarUsuario(usuario.id);
  // Semilla nueva: empieza como usuario nuevo, con otro orden de frases nuevas.
  await renovarSemilla(usuario.id);
  olvidarSemilla(usuario.id);
  await empezarLimpio(usuario.id);
  return usuario;
}
