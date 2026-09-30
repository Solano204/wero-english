import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '@/db/client';
import { initProgress } from '@/db/progress';
import type { AuthError, Credentials, PerfilGoogle, User } from '@/types';

/**
 * Cuentas locales con usuario y contraseña, sin Google y sin servidor.
 *
 * Sobre la seguridad, con honestidad: la contraseña se guarda como
 * SHA-256 con sal por usuario. Eso protege de que alguien abra la base
 * y lea las contraseñas en claro, y nada más. No es PBKDF2 ni Argon2,
 * así que si algún día hay servidor y sincronización, esto se cambia.
 * Para una app local sin datos sensibles es proporcionado.
 */

const SESSION_KEY = 'wero.session.userId';
const USER_RE = /^[a-zA-Z0-9._]{3,24}$/;
const PASS_MIN = 6;

interface UsuarioRow {
  id: number;
  username: string;
  created_at: number;
  last_login: number | null;
  google_sub: string | null;
  email: string | null;
  nombre: string | null;
  foto: string | null;
}

const COLUMNAS_USUARIO =
  'id, username, created_at, last_login, google_sub, email, nombre, foto';

function filaAUsuario(row: UsuarioRow): User {
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

export class AuthFailure extends Error {
  constructor(public readonly code: AuthError) {
    super(code);
    this.name = 'AuthFailure';
  }
}

async function hash(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}::${password}`
  );
}

function makeSalt(): string {
  const bytes = Crypto.getRandomBytes(16);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function validate(c: Credentials): void {
  const u = c.username.trim();
  if (u.length < 3) throw new AuthFailure('usuario_corto');
  if (!USER_RE.test(u)) throw new AuthFailure('usuario_invalido');
  if (c.password.length < PASS_MIN) throw new AuthFailure('password_corto');
}

export async function signUp(c: Credentials): Promise<User> {
  validate(c);
  const db = await getDb();
  const username = c.username.trim();

  const dupe = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM usuario WHERE username = ? COLLATE NOCASE;',
    [username]
  );
  if (dupe) throw new AuthFailure('usuario_ocupado');

  const salt = makeSalt();
  const pass = await hash(c.password, salt);
  const now = Date.now();

  const res = await db.runAsync(
    `INSERT INTO usuario (username, pass_hash, pass_salt, created_at, last_login)
     VALUES (?,?,?,?,?);`,
    [username, pass, salt, now, now]
  );

  const id = res.lastInsertRowId;
  await initProgress(id);
  await persistSession(id);

  return { id, username, created_at: now, last_login: now, google_sub: null, email: null, nombre: null, foto: null };
}

export async function signIn(c: Credentials): Promise<User> {
  const db = await getDb();
  const username = c.username.trim();

  const row = await db.getFirstAsync<UsuarioRow & { pass_hash: string; pass_salt: string }>(
    `SELECT ${COLUMNAS_USUARIO}, pass_hash, pass_salt FROM usuario WHERE username = ? COLLATE NOCASE;`,
    [username]
  );

  if (!row) throw new AuthFailure('credenciales_malas');

  const attempt = await hash(c.password, row.pass_salt);
  if (attempt !== row.pass_hash) throw new AuthFailure('credenciales_malas');

  const now = Date.now();
  await db.runAsync('UPDATE usuario SET last_login = ? WHERE id = ?;', [
    now,
    row.id,
  ]);
  await persistSession(row.id);

  return filaAUsuario({ ...row, last_login: now });
}

export async function changePassword(
  userId: number,
  oldPass: string,
  newPass: string
): Promise<void> {
  if (newPass.length < PASS_MIN) throw new AuthFailure('password_corto');
  const db = await getDb();

  const row = await db.getFirstAsync<{
    pass_hash: string;
    pass_salt: string;
  }>('SELECT pass_hash, pass_salt FROM usuario WHERE id = ?;', [userId]);
  if (!row) throw new AuthFailure('desconocido');

  const attempt = await hash(oldPass, row.pass_salt);
  if (attempt !== row.pass_hash) throw new AuthFailure('credenciales_malas');

  const salt = makeSalt();
  const pass = await hash(newPass, salt);
  await db.runAsync(
    'UPDATE usuario SET pass_hash = ?, pass_salt = ? WHERE id = ?;',
    [pass, salt, userId]
  );
}

/** Recupera la sesión guardada. Se llama en el arranque. */
export async function restoreSession(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  const id = Number(raw);
  if (!Number.isFinite(id)) return null;

  const db = await getDb();
  const row = await db.getFirstAsync<UsuarioRow>(
    `SELECT ${COLUMNAS_USUARIO} FROM usuario WHERE id = ?;`,
    [id]
  );

  if (!row) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
  return filaAUsuario(row);
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

/**
 * Tablas con `usuario_id` que NO se borran en cascada al borrar el usuario (no tienen llave
 * foránea): se borran a mano para que no quede ni una fila de esa persona.
 */
const TABLAS_SIN_CASCADA = ['pack_estado', 'notif_log', 'extra_visto'] as const;
/** Adornos por usuario que viven en AsyncStorage y no en la base (ver practicar/celebracion.ts). */
const CELEBRACIONES = ['meta', 'reto', 'record'] as const;

/**
 * Borra la cuenta y TODO su avance del teléfono: el usuario (y en cascada tarjetas, progreso,
 * ajustes, sesiones, juegos, habla, niveles, cartera y desbloqueos), las tablas sin cascada y sus
 * marcas en AsyncStorage. No hay servidor, así que después de esto no queda nada en ningún lado.
 * El catálogo y los packs descargados (contenido de la app, no de la persona) se quedan.
 */
export async function deleteAccount(userId: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const tabla of TABLAS_SIN_CASCADA) {
      await db.runAsync(`DELETE FROM ${tabla} WHERE usuario_id = ?;`, [userId]);
    }
    await db.runAsync('DELETE FROM usuario WHERE id = ?;', [userId]);
  });
  await AsyncStorage.multiRemove(CELEBRACIONES.map((t) => `wero:${t}-celebrada:${userId}`));
  await signOut();
}

export async function listUsers(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ username: string }>(
    'SELECT username FROM usuario ORDER BY last_login DESC;'
  );
  return rows.map((r) => r.username);
}

/**
 * "Entrar sin cuenta": crea una cuenta local igual que signUp, pero sin
 * pedir usuario ni contraseña (se generan y nunca se usan para entrar).
 * Guarda en el teléfono exactamente igual que hoy.
 *
 * Si en este teléfono ya hubo alguien "sin cuenta" (y no se vinculó a
 * Google), vuelve a ese mismo usuario: cerrar sesión y entrar otra vez sin
 * cuenta no debe dejar su avance huérfano en la base.
 */
export async function continuarSinCuenta(): Promise<User> {
  const db = await getDb();
  const previo = await db.getFirstAsync<UsuarioRow>(
    `SELECT ${COLUMNAS_USUARIO} FROM usuario
     WHERE substr(username, 1, 9) = 'invitado_' AND google_sub IS NULL
     ORDER BY last_login DESC LIMIT 1;`
  );
  if (previo) {
    const now = Date.now();
    await db.runAsync('UPDATE usuario SET last_login = ? WHERE id = ?;', [now, previo.id]);
    await persistSession(previo.id);
    return filaAUsuario({ ...previo, last_login: now });
  }

  const username = `invitado_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const salt = makeSalt();
  const pass = await hash(makeSalt(), salt);
  const now = Date.now();

  const res = await db.runAsync(
    `INSERT INTO usuario (username, pass_hash, pass_salt, created_at, last_login)
     VALUES (?,?,?,?,?);`,
    [username, pass, salt, now, now]
  );
  const id = res.lastInsertRowId;
  await initProgress(id);
  await persistSession(id);

  return { id, username, created_at: now, last_login: now, google_sub: null, email: null, nombre: null, foto: null };
}

/** El usuario local (sin Google) que se usó más recientemente en este teléfono, si hay alguno. */
export async function cuentaLocalParaVincular(): Promise<{ id: number; username: string } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number; username: string }>(
    `SELECT id, username FROM usuario WHERE google_sub IS NULL ORDER BY last_login DESC LIMIT 1;`
  );
  return row ?? null;
}

export type ResultadoGoogle =
  | { tipo: 'entro'; usuario: User }
  | { tipo: 'ofrecer_vincular'; candidato: { id: number; username: string } };

/**
 * Con el perfil que ya devolvió iniciarSesion() nativo: si ese google_sub
 * ya tiene cuenta aquí, entra directo. Si no, y hay una cuenta local sin
 * vincular, deja que la pantalla ofrezca "Vincular tu avance" antes de
 * decidir (vincularGoogle o crearCuentaGoogle). Sin ninguna cuenta local,
 * crea una nueva de una vez: no hay nada que ofrecer vincular.
 */
export async function resolverGoogle(perfil: PerfilGoogle): Promise<ResultadoGoogle> {
  const db = await getDb();
  const existente = await db.getFirstAsync<UsuarioRow>(
    `SELECT ${COLUMNAS_USUARIO} FROM usuario WHERE google_sub = ?;`,
    [perfil.sub]
  );
  if (existente) {
    const now = Date.now();
    await db.runAsync(
      'UPDATE usuario SET last_login = ?, email = ?, nombre = ?, foto = ? WHERE id = ?;',
      [now, perfil.email, perfil.nombre, perfil.foto, existente.id]
    );
    await persistSession(existente.id);
    return { tipo: 'entro', usuario: filaAUsuario({ ...existente, last_login: now, email: perfil.email, nombre: perfil.nombre, foto: perfil.foto }) };
  }

  const candidato = await cuentaLocalParaVincular();
  if (candidato) return { tipo: 'ofrecer_vincular', candidato };

  return { tipo: 'entro', usuario: await crearCuentaGoogle(perfil) };
}

/** Vincula el perfil de Google a una cuenta local que YA existe: todo su avance se queda igual, solo cambia cómo entra. */
export async function vincularGoogle(usuarioId: number, perfil: PerfilGoogle): Promise<User> {
  const db = await getDb();
  const ocupado = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM usuario WHERE google_sub = ? AND id != ?;',
    [perfil.sub, usuarioId]
  );
  if (ocupado) throw new AuthFailure('google_vinculado_otro');

  const now = Date.now();
  await db.runAsync(
    'UPDATE usuario SET google_sub = ?, email = ?, nombre = ?, foto = ?, last_login = ? WHERE id = ?;',
    [perfil.sub, perfil.email, perfil.nombre, perfil.foto, now, usuarioId]
  );
  await persistSession(usuarioId);

  const row = await db.getFirstAsync<UsuarioRow>(`SELECT ${COLUMNAS_USUARIO} FROM usuario WHERE id = ?;`, [usuarioId]);
  if (!row) throw new AuthFailure('desconocido');
  return filaAUsuario(row);
}

/** Cuenta nueva para un perfil de Google que nunca se había visto en este teléfono, sin vincular nada existente. */
export async function crearCuentaGoogle(perfil: PerfilGoogle): Promise<User> {
  const db = await getDb();
  const salt = makeSalt();
  const pass = await hash(makeSalt(), salt);
  const now = Date.now();

  const res = await db.runAsync(
    `INSERT INTO usuario (username, pass_hash, pass_salt, google_sub, email, nombre, foto, created_at, last_login)
     VALUES (?,?,?,?,?,?,?,?,?);`,
    [`google:${perfil.sub}`, pass, salt, perfil.sub, perfil.email, perfil.nombre, perfil.foto, now, now]
  );
  const id = res.lastInsertRowId;
  await initProgress(id);
  await persistSession(id);

  return {
    id,
    username: `google:${perfil.sub}`,
    created_at: now,
    last_login: now,
    google_sub: perfil.sub,
    email: perfil.email,
    nombre: perfil.nombre,
    foto: perfil.foto,
  };
}

async function persistSession(id: number): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, String(id));
}
