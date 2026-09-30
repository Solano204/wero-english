import { useState } from 'react';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import * as notifications from '@/services/notificaciones';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';

/**
 * Los primeros pasos: el paso actual, lo que se elige en cada uno y cómo se guarda al terminar.
 */
export function usePrimerosPasos() {
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore();
  const [paso, setPaso] = useState(0);
  const [permisoNegado, setPermisoNegado] = useState(false);
  // En Expo Go no hay notificaciones desde el SDK 53. Se dice tal cual
  // en vez de fingir que el usuario negó un permiso que nunca se pidió.
  const notifEstado = notifications.isAvailable();

  const avanzar = () => setPaso((p) => p + 1);
  const [slide, setSlide] = useState(0);

  const terminar = async () => {
    if (!user) return;
    await settings.set(user.id, 'onboardingHecho', true);
  };

  const saltarTodo = async () => {
    // Saltar deja los valores por omisión y entra. Nunca se atrapa a
    // nadie en el onboarding.
    await terminar();
  };

  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();

  const pedirNotificaciones = async () => {
    if (!user) return;
    if (!notifEstado.ok) {
      await terminar();
      return;
    }
    // Primero la hoja que explica cuáles y cada cuánto; «Ahora no» sigue sin recordatorios.
    if (!(await pedirConsentimiento('notificaciones'))) {
      await settings.set(user.id, 'notificaciones', false);
      await terminar();
      return;
    }
    const ok = await notifications.requestPermission();
    if (!ok) {
      setPermisoNegado(true);
      await settings.set(user.id, 'notificaciones', false);
      return;
    }
    await settings.set(user.id, 'notificaciones', true);
    await notifications.setupChannel();
    await notifications.scheduleNext({
      usuarioId: user.id,
      config: loadContent().notificaciones,
      filter: settings.filter(),
      hora: settings.horaNotificacion,
      racha: 0,
      porDia: settings.notifPorDia,
      desde: settings.notifDesde,
      hasta: settings.notifHasta,
    });
    await terminar();
  };

  // Presentación, groserías, recordatorios y cierre. El onboarding ya no pregunta nada que decida
  // qué frases te tocan: esas llegan en un orden al azar propio de cada usuario.
  const total = 4;

  return { user, settings, paso, permisoNegado, notifEstado, avanzar, slide, setSlide, terminar, saltarTodo, hoja, pedirNotificaciones, total };
}
