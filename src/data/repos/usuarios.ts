import { getDb } from '@/data/cliente';
import { nuevaSemilla } from '@/data/semilla/semillaAleatoria';
import type { PerfilGoogle, User } from '@/types';

/**
 * La tabla `usuario`: cuentas locales, invitados y cuentas de Google. Solo SQL; las reglas de la cuenta
 * (validar, sal y hash, sesión) viven en services/cuenta/auth.ts.
 */

export interface UsuarioRow {
  id: number;
  username: string;
  created_at: number;
  last_login: number | null;
  google_sub: string | null;
  email: string | null;
  nombre: string | null;
  foto: string | null;
}

export interface Credencial {
  pass_hash: string;
  pass_salt: string;
}

const COLUMNAS_USUARIO =
  'id, username, created_at, last_login, google_sub, email, nombre, foto';

export function filaAUsuario(row: UsuarioRow): User {
  return {
    id: row.id,
    username: row.username,
    created_at: row.created_at,
    last_login: row.last_login,
    google_sub: row.google_sub,
    email: row.email,
    nombre: row.nombre,
    foto: row.foto,
  };
}

/** ¿Ya hay alguien con ese nombre de usuario (sin distinguir mayúsculas)? */
export async function existeNombre(username: string): Promise<boolean> {
  const db = await getDb();
  const dupe = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM usuario WHERE username = ? COLLATE NOCASE;',
    [username]
  );
  return dupe != null;
}

/** Inserta una cuenta local (o de invitado) y devuelve su id. */
export async function insertarUsuarioLocal(username: string, passHash: string, passSalt: string, ahora: number): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO usuario (username, pass_hash, pass_salt, created_at, last_login, semilla)
     VALUES (?,?,?,?,?,?);`,
    [username, passHash, passSalt, ahora, ahora, nuevaSemilla()]
  );
  return res.lastInsertRowId;
}

/** Inserta una cuenta de Google y devuelve su id. */
export async function insertarUsuarioGoogle(perfil: PerfilGoogle, passHash: string, passSalt: string, ahora: number): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO usuario (username, pass_hash, pass_salt, google_sub, email, nombre, foto, created_at, last_login, semilla)
     VALUES (?,?,?,?,?,?,?,?,?,?);`,
    [`google:${perfil.sub}`, passHash, passSalt, perfil.sub, perfil.email, perfil.nombre, perfil.foto, ahora, ahora, nuevaSemilla()]
  );
  return res.lastInsertRowId;
}

/** El usuario y su credencial, por nombre (sin distinguir mayúsculas). */
export async function usuarioConCredencial(username: string): Promise<(UsuarioRow & Credencial) | null> {
  const db = await getDb();
  return db.getFirstAsync<UsuarioRow & Credencial>(
    `SELECT ${COLUMNAS_USUARIO}, pass_hash, pass_salt FROM usuario WHERE username = ? COLLATE NOCASE;`,
    [username]
  );
}

export async function credencialDe(usuarioId: number): Promise<Credencial | null> {
  const db = await getDb();
  return db.getFirstAsync<Credencial>('SELECT pass_hash, pass_salt FROM usuario WHERE id = ?;', [usuarioId]);
}

export async function guardarCredencial(usuarioId: number, passHash: string, passSalt: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE usuario SET pass_hash = ?, pass_salt = ? WHERE id = ?;',
    [passHash, passSalt, usuarioId]
  );
}

export async function marcarEntrada(usuarioId: number, ahora: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE usuario SET last_login = ? WHERE id = ?;', [ahora, usuarioId]);
}

export async function usuarioPorId(usuarioId: number): Promise<UsuarioRow | null> {
  const db = await getDb();
  return db.getFirstAsync<UsuarioRow>(`SELECT ${COLUMNAS_USUARIO} FROM usuario WHERE id = ?;`, [usuarioId]);
}

/** Los nombres de usuario, del que entró más recientemente al que menos. */
export async function nombresDeUsuario(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ username: string }>(
    'SELECT username FROM usuario ORDER BY last_login DESC;'
  );
  return rows.map((r) => r.username);
}

/** El invitado (sin Google) que entró más recientemente, si hay alguno. */
export async function invitadoMasReciente(): Promise<UsuarioRow | null> {
  const db = await getDb();
  return db.getFirstAsync<UsuarioRow>(
    `SELECT ${COLUMNAS_USUARIO} FROM usuario
     WHERE substr(username, 1, 9) = 'invitado_' AND google_sub IS NULL
     ORDER BY last_login DESC LIMIT 1;`
  );
}

/** El usuario local (sin Google) que se usó más recientemente en este teléfono, si hay alguno. */
export async function localSinGoogle(): Promise<{ id: number; username: string } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number; username: string }>(
    `SELECT id, username FROM usuario WHERE google_sub IS NULL ORDER BY last_login DESC LIMIT 1;`
  );
  return row ?? null;
}

export async function usuarioPorGoogle(sub: string): Promise<UsuarioRow | null> {
  const db = await getDb();
  return db.getFirstAsync<UsuarioRow>(`SELECT ${COLUMNAS_USUARIO} FROM usuario WHERE google_sub = ?;`, [sub]);
}

/** Al entrar con Google: la fecha de entrada y el perfil al día. */
export async function actualizarPerfilGoogle(usuarioId: number, perfil: PerfilGoogle, ahora: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE usuario SET last_login = ?, email = ?, nombre = ?, foto = ? WHERE id = ?;',
    [ahora, perfil.email, perfil.nombre, perfil.foto, usuarioId]
  );
}

/** ¿Ese perfil de Google ya está vinculado a OTRA cuenta de este teléfono? */
export async function googleDeOtro(sub: string, usuarioId: number): Promise<boolean> {
  const db = await getDb();
  const ocupado = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM usuario WHERE google_sub = ? AND id != ?;',
    [sub, usuarioId]
  );
  return ocupado != null;
}

export async function guardarVinculoGoogle(usuarioId: number, perfil: PerfilGoogle, ahora: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE usuario SET google_sub = ?, email = ?, nombre = ?, foto = ?, last_login = ? WHERE id = ?;',
    [perfil.sub, perfil.email, perfil.nombre, perfil.foto, ahora, usuarioId]
  );
}

export async function borrarUsuario(usuarioId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM usuario WHERE id = ?;', [usuarioId]);
}

/** Semilla nueva: el mismo usuario empieza con otro orden de frases nuevas. */
export async function renovarSemilla(usuarioId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE usuario SET semilla = ? WHERE id = ?;', [nuevaSemilla(), usuarioId]);
}
