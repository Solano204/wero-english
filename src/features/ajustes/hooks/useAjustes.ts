import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import * as notifications from '@/services/notificaciones';
import * as speech from '@/services/voz';
import { copiarReporteDeFallas } from '@/services/fallas';
import type { Nivel } from '@/types';
import type { RootStackParams } from '@/types/rutas';
import { useShallow } from 'zustand/react/shallow';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Ajustes: lo que la pantalla muestra y cambia (preferencias, notificaciones, sonido, cuenta y legal).
 */
export function useAjustes() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  // Solo los ajustes que pinta esta pantalla (y set): no se repinta por llaves que no muestra (los grupos de
  // Practicar, `loaded`, las marcas de lecturas…).
  const s = useSettingsStore(
    useShallow((st) => ({
      autoAudio: st.autoAudio,
      filter: st.filter,
      haptics: st.haptics,
      horaNotificacion: st.horaNotificacion,
      metaDiaria: st.metaDiaria,
      modoLimpio: st.modoLimpio,
      mostrarSeguidas: st.mostrarSeguidas,
      musica: st.musica,
      musicaJuegosDistinta: st.musicaJuegosDistinta,
      niveles: st.niveles,
      notifDesde: st.notifDesde,
      notifHasta: st.notifHasta,
      notifPorDia: st.notifPorDia,
      notificaciones: st.notificaciones,
      nuevasPorDia: st.nuevasPorDia,
      set: st.set,
      soloWifi: st.soloWifi,
      sonidosFeedback: st.sonidosFeedback,
      volumenMusica: st.volumenMusica,
    }))
  );
  const [cargaLenta, setCargaLenta] = useState(false);
  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();
  const micEstado = speech.isAvailable();
  const notifEstado = notifications.isAvailable();

  const cambiar = async <K extends keyof typeof s>(key: K, value: (typeof s)[K]) => {
    if (!user) return;
    // El cast es necesario: el tipo del store incluye métodos además
    // de los ajustes, y set() solo acepta las claves de Settings.
    await s.set(user.id, key as never, value as never);
  };

  const alternarNivel = (n: Nivel) => {
    const tiene = s.niveles.includes(n);
    // Nunca se pueden apagar los tres: quedaría una app sin contenido.
    if (tiene && s.niveles.length === 1) return;
    const next = tiene
      ? s.niveles.filter((x) => x !== n)
      : [...s.niveles, n].sort();
    void cambiar('niveles', next as never);
  };

  // Ajustes → Acerca de: el reporte de errores guardado en el teléfono, al portapapeles.
  const [reporte, setReporte] = useState<'listo' | 'copiado' | 'fallo'>('listo');
  const copiarReporte = async () => setReporte((await copiarReporteDeFallas()) ? 'copiado' : 'fallo');

  return { nav, user, signOut, s, cargaLenta, setCargaLenta, pedirConsentimiento, hoja, micEstado, notifEstado, cambiar, alternarNivel, reporte, copiarReporte };
}
