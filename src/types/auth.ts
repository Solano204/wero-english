export interface User {
  id: number;
  username: string;
  created_at: number;
  last_login: number | null;
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
  | 'desconocido';

export const AUTH_MESSAGES: Record<AuthError, string> = {
  usuario_corto: 'El usuario necesita al menos 3 letras.',
  usuario_invalido: 'Solo letras, números, punto y guion bajo.',
  usuario_ocupado: 'Ese usuario ya existe en este teléfono.',
  password_corto: 'La contraseña necesita al menos 6 caracteres.',
  credenciales_malas: 'Usuario o contraseña incorrectos.',
  desconocido: 'No se pudo completar. Intenta de nuevo; si sigue igual, cierra y abre la app.',
};
