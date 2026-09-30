export interface User {
  id: number;
  username: string;
  created_at: number;
  last_login: number | null;
  /** Con cuenta de Google: null en cuentas locales (usuario/contraseña o "sin cuenta"). */
  google_sub: string | null;
  email: string | null;
  nombre: string | null;
  foto: string | null;
}

/** Lo que trae el perfil de Google al iniciar sesión. */
export interface PerfilGoogle {
  sub: string;
  email: string | null;
  nombre: string | null;
  foto: string | null;
  idToken: string;
}

export interface Credentials {
  username: string;
  password: string;
}

export type AuthError =
  | 'usuario_corto'
  | 'usuario_invalido'
  | 'usuario_ocupado'
  | 'password_corto'
  | 'credenciales_malas'
  | 'google_cancelado'
  | 'google_sin_cuentas'
  | 'google_sin_internet'
  | 'google_configuracion'
  | 'google_vinculado_otro'
  | 'desconocido';

export const AUTH_MESSAGES: Record<AuthError, string> = {
  usuario_corto: 'El usuario necesita al menos 3 letras.',
  usuario_invalido: 'Solo letras, números, punto y guion bajo.',
  usuario_ocupado: 'Ese usuario ya existe en este teléfono.',
  password_corto: 'La contraseña necesita al menos 6 caracteres.',
  credenciales_malas: 'Usuario o contraseña incorrectos.',
  google_cancelado: 'Cerraste la ventana de Google. Intenta de nuevo cuando quieras.',
  google_sin_cuentas: 'Este teléfono no tiene ninguna cuenta de Google. Agrega una en Ajustes del sistema, o entra sin cuenta.',
  google_sin_internet: 'Sin internet no se puede entrar con Google. Conéctate y vuelve a intentar, o entra sin cuenta.',
  google_configuracion: 'Google no está listo todavía en esta versión de la app. Entra sin cuenta mientras tanto.',
  google_vinculado_otro: 'Esa cuenta de Google ya está en otro perfil de este teléfono.',
  desconocido: 'No se pudo completar. Intenta de nuevo; si sigue igual, cierra y abre la app.',
};
