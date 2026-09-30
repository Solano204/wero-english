import { useCallback, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import * as notifications from '@/services/notificaciones';
import * as speech from '@/services/voz';
import type { Nivel } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Ajustes: lo que la pantalla muestra y cambia (preferencias, notificaciones, sonido, cuenta y legal).
 */
export function useAjustes() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const s = useSettingsStore();
  const [cargaLenta, setCargaLenta] = useState(false);
  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();
  const micEstado = useMemo(() => speech.isAvailable(), []);
  const notifEstado = useMemo(() => notifications.isAvailable(), []);

  const cambiar = useCallback(
    async <K extends keyof typeof s>(key: K, value: (typeof s)[K]) => {
      if (!user) return;
      // El cast es necesario: el tipo del store incluye métodos además
      // de los ajustes, y set() solo acepta las claves de Settings.
      await s.set(user.id, key as never, value as never);
    },
    [user, s]
  );

  const alternarNivel = useCallback(
    (n: Nivel) => {
      const tiene = s.niveles.includes(n);
      // Nunca se pueden apagar los tres: quedaría una app sin contenido.
      if (tiene && s.niveles.length === 1) return;
      const next = tiene
        ? s.niveles.filter((x) => x !== n)
        : [...s.niveles, n].sort();
      void cambiar('niveles', next as never);
    },
    [s.niveles, cambiar]
  );

  return { nav, user, signOut, s, cargaLenta, setCargaLenta, pedirConsentimiento, hoja, micEstado, notifEstado, cambiar, alternarNivel };
}
