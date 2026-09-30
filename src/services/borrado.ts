import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '@/data/cliente';
import { initProgress } from '@/data/repos/progreso';
import { saveSetting } from '@/data/repos/ajustes';
import { nuevaSemilla, olvidarSemilla } from '@/data/semilla/semillaAleatoria';
import * as downloads from './downloads';
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
 * Qué tablas son "del usuario" no está escrito a mano: se buscan en la base todas las que tienen
 * una columna `usuario_id`, así una tabla nueva nunca se queda fuera de un borrado.
 */

/** Marcas por usuario que viven en AsyncStorage y no en la base (ver practicar/celebracion.ts). */
const CELEBRACIONES = ['meta', 'reto', 'record'] as const;

async function tablasDelUsuario(): Promise<string[]> {
  const db = await getDb();
  const tablas = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`
  );
  const conUsuario: string[] = [];
  for (const { name } of tablas) {
    // El nombre sale de sqlite_master, no de la persona: no hay nada que inyectar.
    const columnas = await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${name}");`);
    if (columnas.some((c) => c.name === 'usuario_id')) conUsuario.push(name);
  }
  return conUsuario;
}

/**
 * Los packs que esta persona descargó y nadie más en el teléfono tiene: sus archivos se pueden
 * borrar. Los que otro perfil también bajó se quedan (son contenido de la app, no de la persona).
 */
async function packsSoloSuyos(usuarioId: number): Promise<string[]> {
  const db = await getDb();
  const filas = await db.getAllAsync<{ pack_id: string }>(
    `SELECT pack_id FROM pack_estado p
      WHERE p.usuario_id = ? AND p.descargado = 1
        AND NOT EXISTS (
          SELECT 1 FROM pack_estado o
           WHERE o.pack_id = p.pack_id AND o.usuario_id != p.usuario_id AND o.descargado = 1
        );`,
    [usuarioId]
  );
  return filas.map((f) => f.pack_id);
}

/** Borra el avance y todo lo que cuelga del usuario, sin tocar la fila del usuario. */
async function vaciarUsuario(usuarioId: number): Promise<void> {
  for (const packId of await packsSoloSuyos(usuarioId)) {
    await downloads.deletePackMedia(usuarioId, packId);
  }
  const tablas = await tablasDelUsuario();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const tabla of tablas) {
      await db.runAsync(`DELETE FROM "${tabla}" WHERE usuario_id = ?;`, [usuarioId]);
    }
  });
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
  const db = await getDb();
  await db.runAsync('DELETE FROM usuario WHERE id = ?;', [usuarioId]);
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
    const db = await getDb();
    await db.runAsync('DELETE FROM usuario WHERE id = ?;', [usuario.id]);
    olvidarSemilla(usuario.id);
    const nuevo = await continuarSinCuenta({ nuevo: true });
    await empezarLimpio(nuevo.id);
    return nuevo;
  }
  await vaciarUsuario(usuario.id);
  // Semilla nueva: empieza como usuario nuevo, con otro orden de frases nuevas.
  const db = await getDb();
  await db.runAsync('UPDATE usuario SET semilla = ? WHERE id = ?;', [nuevaSemilla(), usuario.id]);
  olvidarSemilla(usuario.id);
  await empezarLimpio(usuario.id);
  return usuario;
}
