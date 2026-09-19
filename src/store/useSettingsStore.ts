import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSetting,
  type Settings,
} from '@/db/settings';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import * as music from '@/services/music';
import type { ContentFilter } from '@/db/queries';

interface SettingsState extends Settings {
  loaded: boolean;
  load: (usuarioId: number) => Promise<void>;
  set: <K extends keyof Settings>(
    usuarioId: number,
    key: K,
    value: Settings[K]
  ) => Promise<void>;
  /** El filtro que consumen todas las consultas de contenido. */
  filter: () => ContentFilter;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  load: async (usuarioId) => {
    const s = await loadSettings(usuarioId);
    haptics.setHapticsEnabled(s.haptics);
    audio.setSfxEnabled(s.sonidosFeedback);
    music.setVolumen(s.volumenMusica / 100);
    music.setActiva(s.musica);
    set({ ...s, loaded: true });
  },

  set: async (usuarioId, key, value) => {
    set({ [key]: value } as Partial<SettingsState>);
    if (key === 'haptics') haptics.setHapticsEnabled(Boolean(value));
    if (key === 'sonidosFeedback') audio.setSfxEnabled(Boolean(value));
    if (key === 'volumenMusica') music.setVolumen(Number(value) / 100);
    if (key === 'musica') music.setActiva(Boolean(value));
    await saveSetting(usuarioId, key, value);
  },

  filter: () => {
    const s = get();
    return { modoLimpio: s.modoLimpio, niveles: s.niveles };
  },
}));
