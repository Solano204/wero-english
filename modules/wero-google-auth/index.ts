import { requireNativeModule } from 'expo-modules-core';

/** Lo que devuelve Google del perfil de la cuenta elegida. El idToken solo sirve para leer estos datos: no hay servidor que lo verifique. */
export interface PerfilGoogle {
  sub: string;
  email: string | null;
  nombre: string | null;
  foto: string | null;
  idToken: string;
}

interface WeroGoogleAuthNativeModule {
  iniciarSesion(serverClientId: string): Promise<PerfilGoogle>;
  iniciarSesionAutomatica(serverClientId: string): Promise<PerfilGoogle | null>;
  cerrarSesion(): Promise<void>;
}

/** El ID de cliente "Aplicación web" que pide Credential Manager, aunque no haya servidor. Nunca quemado en el código. */
const SERVER_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

/**
 * En Expo Go no existe este módulo nativo (requiere un build instalado).
 * `disponible` lo dice antes de llamar a cualquier función, para que la
 * pantalla de entrada oculte el botón o muestre "Disponible en la app
 * instalada" en vez de tronar.
 */
let nativo: WeroGoogleAuthNativeModule | null = null;
try {
  nativo = requireNativeModule<WeroGoogleAuthNativeModule>('WeroGoogleAuth');
} catch {
  nativo = null;
}

/** disponible: hay módulo nativo Y hay un ID de cliente configurado (sin .env, tampoco sirve). */
export const disponible = nativo !== null && SERVER_CLIENT_ID !== '';

/** Sube la hoja de Credential Manager con las cuentas de Google del teléfono. */
export function iniciarSesion(): Promise<PerfilGoogle> {
  if (!nativo || !disponible) {
    return Promise.reject(Object.assign(new Error('ERR_NO_DISPONIBLE'), { code: 'ERR_NO_DISPONIBLE' }));
  }
  return nativo.iniciarSesion(SERVER_CLIENT_ID);
}

/** Sin hoja: solo si ya hay una cuenta de Google autorizada en este teléfono. Null si no hay ninguna. */
export function iniciarSesionAutomatica(): Promise<PerfilGoogle | null> {
  if (!nativo || !disponible) return Promise.resolve(null);
  // Al abrir la app nunca debe fallar hacia afuera: cualquier problema es "no hay cuenta".
  return nativo.iniciarSesionAutomatica(SERVER_CLIENT_ID).catch(() => null);
}

/** Limpia el estado de Credential Manager (ClearCredentialStateRequest). */
export function cerrarSesion(): Promise<void> {
  if (!nativo) return Promise.resolve();
  return nativo.cerrarSesion();
}
