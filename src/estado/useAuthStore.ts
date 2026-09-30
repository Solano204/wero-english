import { create } from 'zustand';
import { useUnlockStore } from './useUnlockStore';
import * as authService from '@/services/cuenta/auth';
import { AuthFailure } from '@/services/cuenta/auth';
import * as googleAuth from '@modules/wero-google-auth';
import * as consentimiento from '@/services/cuenta/consentimiento';
import * as audio from '@/services/audio';
import * as music from '@/services/musica';
import * as notifications from '@/services/notificaciones';
import * as borrado from '@/services/cuenta/borrado';
import { useSettingsStore } from './useSettingsStore';
import { AUTH_MESSAGES, type AuthError, type PerfilGoogle, type User } from '@/types';

type Status = 'booting' | 'anon' | 'signed';

/** Cuando resolverGoogle() encuentra una cuenta local sin vincular: la pantalla de entrada decide. */
export interface VinculoPendiente {
  perfil: PerfilGoogle;
  candidato: { id: number; username: string };
}

interface AuthState {
  status: Status;
  user: User | null;
  error: string | null;
  busy: boolean;
  /** Mientras esto no sea null, la pantalla de entrada muestra "Vincular tu avance a esta cuenta". */
  vinculoPendiente: VinculoPendiente | null;
  /** Un aviso para la pantalla de entrada (p. ej. tras borrar la cuenta). */
  aviso: string | null;

  restore: () => Promise<void>;
  signUp: (username: string, password: string) => Promise<boolean>;
  signIn: (username: string, password: string) => Promise<boolean>;
  continuarSinCuenta: () => Promise<boolean>;
  /** Sube la hoja de Google. Si hay una cuenta local para vincular, deja `vinculoPendiente` puesto y no entra todavía. */
  entrarConGoogle: () => Promise<boolean>;
  /** Resuelve `vinculoPendiente`: true vincula con la cuenta local, false empieza una cuenta nueva. */
  resolverVinculo: (vincular: boolean) => Promise<boolean>;
  cancelarVinculo: () => void;
  signOut: () => Promise<void>;
  /** Borra el usuario y todo su avance del teléfono, cierra la sesión de Google en la app y vuelve a la entrada. */
  eliminarCuenta: () => Promise<boolean>;
  /** Borra todo el avance sin cerrar la sesión (sin cuenta: el perfil completo y se empieza uno nuevo). */
  borrarMisDatos: () => Promise<boolean>;
  limpiarAviso: () => void;
  clearError: () => void;
}

function messageFor(err: unknown): string {
  if (err instanceof AuthFailure) {
    return AUTH_MESSAGES[err.code as AuthError] ?? AUTH_MESSAGES.desconocido;
  }
  return AUTH_MESSAGES.desconocido;
}

async function alEntrar(user: User) {
  void useUnlockStore.getState().cargar(user.id);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  user: null,
  error: null,
  busy: false,
  vinculoPendiente: null,
  aviso: null,

  restore: async () => {
    try {
      const user = await authService.restoreSession();
      if (user) {
        set({ user, status: 'signed' });
        void alEntrar(user);
        return;
      }
      // Sin sesión local guardada: si este teléfono ya autorizó una
      // cuenta de Google antes (aunque sea en otra instalación), entra
      // directo y sin hoja. Cualquier motivo por el que no aplique
      // (nunca hubo cuenta, no está disponible) deja el status en 'anon'
      // y la pantalla de entrada se ve normal.
      // Solo si en este teléfono ya se aceptó usar la cuenta de Google con la versión vigente del
      // aviso: sin eso, nada de Google corre al abrir la app.
      const perfil = (await consentimiento.vigente('google')) ? await googleAuth.iniciarSesionAutomatica() : null;
      if (!perfil) {
        set({ user: null, status: 'anon' });
        return;
      }
      const resultado = await authService.resolverGoogle(perfil);
      if (resultado.tipo === 'entro') {
        set({ user: resultado.usuario, status: 'signed' });
        void alEntrar(resultado.usuario);
      } else {
        // Rarísimo en automático (implica una cuenta local sin vincular
        // en un teléfono que Android ya reconoce): mejor pedir confirmación
        // a mano que vincular solo, sin que la persona lo haya pedido.
        set({ user: null, status: 'anon' });
      }
    } catch {
      set({ user: null, status: 'anon' });
    }
  },

  signUp: async (username, password) => {
    set({ busy: true, error: null });
    try {
      const user = await authService.signUp({ username, password });
      set({ user, status: 'signed', busy: false });
      void alEntrar(user);
      return true;
    } catch (err) {
      set({ error: messageFor(err), busy: false });
      return false;
    }
  },

  signIn: async (username, password) => {
    set({ busy: true, error: null });
    try {
      const user = await authService.signIn({ username, password });
      set({ user, status: 'signed', busy: false });
      void alEntrar(user);
      return true;
    } catch (err) {
      set({ error: messageFor(err), busy: false });
      return false;
    }
  },

  continuarSinCuenta: async () => {
    set({ busy: true, error: null });
    try {
      const user = await authService.continuarSinCuenta();
      set({ user, status: 'signed', busy: false });
      void alEntrar(user);
      return true;
    } catch (err) {
      set({ error: messageFor(err), busy: false });
      return false;
    }
  },

  entrarConGoogle: async () => {
    set({ busy: true, error: null });
    try {
      const perfil = await googleAuth.iniciarSesion();
      const resultado = await authService.resolverGoogle(perfil);
      if (resultado.tipo === 'entro') {
        set({ user: resultado.usuario, status: 'signed', busy: false });
        void alEntrar(resultado.usuario);
        return true;
      }
      set({ busy: false, vinculoPendiente: { perfil, candidato: resultado.candidato } });
      return false;
    } catch (err) {
      set({ error: messageFor(mapearErrorGoogle(err)), busy: false });
      if (__DEV__) console.warn('[auth] Google', err);
      return false;
    }
  },

  resolverVinculo: async (vincular) => {
    const pendiente = get().vinculoPendiente;
    if (!pendiente) return false;
    set({ busy: true, error: null });
    try {
      const user = vincular
        ? await authService.vincularGoogle(pendiente.candidato.id, pendiente.perfil)
        : await authService.crearCuentaGoogle(pendiente.perfil);
      set({ user, status: 'signed', busy: false, vinculoPendiente: null });
      void alEntrar(user);
      return true;
    } catch (err) {
      set({ error: messageFor(err), busy: false, vinculoPendiente: null });
      return false;
    }
  },

  cancelarVinculo: () => set({ vinculoPendiente: null }),

  signOut: async () => {
    audio.releaseAudio();
    music.liberar();
    await authService.signOut();
    await googleAuth.cerrarSesion();
    set({ user: null, status: 'anon', error: null });
  },

  eliminarCuenta: async () => {
    const user = get().user;
    if (!user) return false;
    set({ busy: true, error: null });
    try {
      audio.detenerTodo();
      audio.releaseAudio();
      music.liberar();
      await notifications.cancelAll();
      await borrado.borrarCuenta(user.id);
      // Sin esto, la próxima vez que se abra la app la entrada automática volvería a entrar con
      // la misma cuenta de Google y crearía un usuario nuevo sin que la persona lo pidiera.
      await googleAuth.cerrarSesion();
      // status 'anon' cambia la navegación entera a la pila de entrada: no hay atrás al que volver.
      set({
        user: null,
        status: 'anon',
        busy: false,
        vinculoPendiente: null,
        aviso: 'Tu cuenta y tus datos se borraron de este teléfono.',
      });
      return true;
    } catch (err) {
      set({ error: messageFor(err), busy: false });
      if (__DEV__) console.warn('[auth] eliminar cuenta', err);
      return false;
    }
  },

  borrarMisDatos: async () => {
    const user = get().user;
    if (!user) return false;
    set({ busy: true, error: null });
    try {
      audio.detenerTodo();
      await notifications.cancelAll();
      const usuario = await borrado.borrarMisDatos(user);
      // Ajustes y desbloqueos vuelven a sus valores de fábrica antes de que se pinte nada.
      await useSettingsStore.getState().load(usuario.id);
      void alEntrar(usuario);
      set({ user: { ...usuario }, busy: false });
      return true;
    } catch (err) {
      set({ error: messageFor(err), busy: false });
      if (__DEV__) console.warn('[auth] borrar mis datos', err);
      return false;
    }
  },

  limpiarAviso: () => set({ aviso: null }),

  clearError: () => set({ error: null }),
}));

/** Los códigos ERR_* que da el módulo nativo (en `.code`, como cualquier error de un módulo de Expo), al vocabulario de errores de la app. */
function mapearErrorGoogle(err: unknown): AuthFailure {
  const conCodigo = err as { code?: unknown; message?: unknown } | null;
  const codigo = String(conCodigo?.code ?? conCodigo?.message ?? err);
  const mapa: Record<string, AuthError> = {
    ERR_CANCELADO: 'google_cancelado',
    ERR_SIN_CUENTAS: 'google_sin_cuentas',
    ERR_SIN_INTERNET: 'google_sin_internet',
    ERR_CONFIGURACION: 'google_configuracion',
    ERR_NO_DISPONIBLE: 'google_configuracion',
    ERR_DESCONOCIDO: 'desconocido',
  };
  return new AuthFailure(mapa[codigo] ?? 'desconocido');
}
