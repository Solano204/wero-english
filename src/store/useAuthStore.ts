import { create } from 'zustand';
import { useUnlockStore } from './useUnlockStore';
import * as authService from '@/services/auth';
import { AuthFailure } from '@/services/auth';
import * as audio from '@/services/audio';
import * as music from '@/services/music';
import { AUTH_MESSAGES, type AuthError, type User } from '@/types';

type Status = 'booting' | 'anon' | 'signed';

interface AuthState {
  status: Status;
  user: User | null;
  error: string | null;
  busy: boolean;

  restore: () => Promise<void>;
  signUp: (username: string, password: string) => Promise<boolean>;
  signIn: (username: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function messageFor(err: unknown): string {
  if (err instanceof AuthFailure) {
    return AUTH_MESSAGES[err.code as AuthError] ?? AUTH_MESSAGES.desconocido;
  }
  return AUTH_MESSAGES.desconocido;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'booting',
  user: null,
  error: null,
  busy: false,

  restore: async () => {
    try {
      const user = await authService.restoreSession();
      set({ user, status: user ? 'signed' : 'anon' });
      // Los desbloqueos se leen una sola vez, aquí. Son unas pocas
      // decenas de claves: tenerlas en memoria evita un viaje a SQLite
      // por cada fila que se pinta en una lista.
      if (user) {
        void useUnlockStore.getState().cargar(user.id);
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
      return true;
    } catch (err) {
      set({ error: messageFor(err), busy: false });
      return false;
    }
  },

  signOut: async () => {
    audio.releaseAudio();
    music.liberar();
    await authService.signOut();
    set({ user: null, status: 'anon', error: null });
  },

  clearError: () => set({ error: null }),
}));
