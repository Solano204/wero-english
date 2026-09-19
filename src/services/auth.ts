import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '@/db/client';
import { initProgress } from '@/db/progress';
import type { AuthError, Credentials, User } from '@/types';

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

  return { id, username, created_at: now, last_login: now };
}

export async function signIn(c: Credentials): Promise<User> {
  const db = await getDb();
  const username = c.username.trim();

  const row = await db.getFirstAsync<{
    id: number;
    username: string;
    pass_hash: string;
    pass_salt: string;
    created_at: number;
  }>(
    'SELECT * FROM usuario WHERE username = ? COLLATE NOCASE;',
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

  return {
    id: row.id,
    username: row.username,
    created_at: row.created_at,
    last_login: now,
  };
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
  const row = await db.getFirstAsync<{
    id: number;
    username: string;
    created_at: number;
    last_login: number | null;
  }>('SELECT id, username, created_at, last_login FROM usuario WHERE id = ?;',
    [id]
  );

  if (!row) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
  return row;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

/** Borra la cuenta y todo su progreso. El catálogo se queda. */
export async function deleteAccount(userId: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM usuario WHERE id = ?;', [userId]);
  });
  await signOut();
}

export async function listUsers(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ username: string }>(
    'SELECT username FROM usuario ORDER BY last_login DESC;'
  );
  return rows.map((r) => r.username);
}

async function persistSession(id: number): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, String(id));
}
