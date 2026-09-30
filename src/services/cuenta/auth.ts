import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initProgress } from '@/data/repos/progreso';
import * as usuarios from '@/data/repos/usuarios';
import { filaAUsuario } from '@/data/repos/usuarios';
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
  const username = c.username.trim();

  if (await usuarios.existeNombre(username)) throw new AuthFailure('usuario_ocupado');

  const salt = makeSalt();
  const pass = await hash(c.password, salt);
  const now = Date.now();

  const id = await usuarios.insertarUsuarioLocal(username, pass, salt, now);
  await initProgress(id);
  await persistSession(id);

  return { id, username, created_at: now, last_login: now, google_sub: null, email: null, nombre: null, foto: null };
}

export async function signIn(c: Credentials): Promise<User> {
  const username = c.username.trim();

  const row = await usuarios.usuarioConCredencial(username);

  if (!row) throw new AuthFailure('credenciales_malas');

  const attempt = await hash(c.password, row.pass_salt);
  if (attempt !== row.pass_hash) throw new AuthFailure('credenciales_malas');

  const now = Date.now();
  await usuarios.marcarEntrada(row.id, now);
  await persistSession(row.id);

  return filaAUsuario({ ...row, last_login: now });
}

export async function changePassword(
  userId: number,
  oldPass: string,
  newPass: string
): Promise<void> {
  if (newPass.length < PASS_MIN) throw new AuthFailure('password_corto');

  const row = await usuarios.credencialDe(userId);
  if (!row) throw new AuthFailure('desconocido');

  const attempt = await hash(oldPass, row.pass_salt);
  if (attempt !== row.pass_hash) throw new AuthFailure('credenciales_malas');

  const salt = makeSalt();
  const pass = await hash(newPass, salt);
  await usuarios.guardarCredencial(userId, pass, salt);
}

/** Recupera la sesión guardada. Se llama en el arranque. */
export async function restoreSession(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  const id = Number(raw);
  if (!Number.isFinite(id)) return null;

  const row = await usuarios.usuarioPorId(id);

  if (!row) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
  return filaAUsuario(row);
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function listUsers(): Promise<string[]> {
  return usuarios.nombresDeUsuario();
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
export async function continuarSinCuenta({ nuevo = false }: { nuevo?: boolean } = {}): Promise<User> {
  // `nuevo`: tras «Borrar todos mis datos» sin cuenta, un perfil en blanco aunque quede otro sin cuenta viejo.
  const previo = nuevo ? null : await usuarios.invitadoMasReciente();
  if (previo) {
    const now = Date.now();
    await usuarios.marcarEntrada(previo.id, now);
    await persistSession(previo.id);
    return filaAUsuario({ ...previo, last_login: now });
  }

  const username = `invitado_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const salt = makeSalt();
  const pass = await hash(makeSalt(), salt);
  const now = Date.now();

  const id = await usuarios.insertarUsuarioLocal(username, pass, salt, now);
  await initProgress(id);
  await persistSession(id);

  return { id, username, created_at: now, last_login: now, google_sub: null, email: null, nombre: null, foto: null };
}

/** El usuario local (sin Google) que se usó más recientemente en este teléfono, si hay alguno. */
export async function cuentaLocalParaVincular(): Promise<{ id: number; username: string } | null> {
  return usuarios.localSinGoogle();
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
  const existente = await usuarios.usuarioPorGoogle(perfil.sub);
  if (existente) {
    const now = Date.now();
    await usuarios.actualizarPerfilGoogle(existente.id, perfil, now);
    await persistSession(existente.id);
    return { tipo: 'entro', usuario: filaAUsuario({ ...existente, last_login: now, email: perfil.email, nombre: perfil.nombre, foto: perfil.foto }) };
  }

  const candidato = await cuentaLocalParaVincular();
  if (candidato) return { tipo: 'ofrecer_vincular', candidato };

  return { tipo: 'entro', usuario: await crearCuentaGoogle(perfil) };
}

/** Vincula el perfil de Google a una cuenta local que YA existe: todo su avance se queda igual, solo cambia cómo entra. */
export async function vincularGoogle(usuarioId: number, perfil: PerfilGoogle): Promise<User> {
  if (await usuarios.googleDeOtro(perfil.sub, usuarioId)) throw new AuthFailure('google_vinculado_otro');

  const now = Date.now();
  await usuarios.guardarVinculoGoogle(usuarioId, perfil, now);
  await persistSession(usuarioId);

  const row = await usuarios.usuarioPorId(usuarioId);
  if (!row) throw new AuthFailure('desconocido');
  return filaAUsuario(row);
}

/** Cuenta nueva para un perfil de Google que nunca se había visto en este teléfono, sin vincular nada existente. */
export async function crearCuentaGoogle(perfil: PerfilGoogle): Promise<User> {
  const salt = makeSalt();
  const pass = await hash(makeSalt(), salt);
  const now = Date.now();

  const id = await usuarios.insertarUsuarioGoogle(perfil, pass, salt, now);
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
