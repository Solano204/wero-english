import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSetting,
  saveSettingsBatch,
  type Settings,
} from '@/data/repos/ajustes';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import * as music from '@/services/musica';
import type { ContentFilter } from '@/types';

interface SettingsState extends Settings {
  loaded: boolean;
  load: (usuarioId: number) => Promise<void>;
  set: <K extends keyof Settings>(
    usuarioId: number,
    key: K,
    value: Settings[K]
  ) => Promise<void>;
  /** Varios ajustes de una vez, guardados en una sola transacción. */
  setVarios: (usuarioId: number, parcial: Partial<Settings>) => Promise<void>;
  /**
   * El filtro que consumen todas las consultas de contenido. Es una función nueva cada vez que cambian el Modo
   * Limpio o los niveles (y solo entonces): las cargas que dependen de `filter` se rehacen al cambiarlos.
   */
  filter: () => ContentFilter;
}

/** Un filtro con los valores de ahora: una función nueva por cada cambio de Modo Limpio o niveles. */
function filtroDe(modoLimpio: boolean, niveles: Settings['niveles']): () => ContentFilter {
  return () => ({ modoLimpio, niveles });
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
    set({ ...s, loaded: true, filter: filtroDe(s.modoLimpio, s.niveles) });
  },

  set: async (usuarioId, key, value) => {
    set({ [key]: value } as Partial<SettingsState>);
    if (key === 'modoLimpio' || key === 'niveles') set({ filter: filtroDe(get().modoLimpio, get().niveles) });
    if (key === 'haptics') haptics.setHapticsEnabled(Boolean(value));
    if (key === 'sonidosFeedback') audio.setSfxEnabled(Boolean(value));
    if (key === 'volumenMusica') music.setVolumen(Number(value) / 100);
    if (key === 'musica') music.setActiva(Boolean(value));
    await saveSetting(usuarioId, key, value);
  },

  setVarios: async (usuarioId, parcial) => {
    set(parcial as Partial<SettingsState>);
    if ('modoLimpio' in parcial) set({ filter: filtroDe(get().modoLimpio, get().niveles) });
    await saveSettingsBatch(usuarioId, parcial);
  },

  filter: filtroDe(DEFAULT_SETTINGS.modoLimpio, DEFAULT_SETTINGS.niveles),
}));
