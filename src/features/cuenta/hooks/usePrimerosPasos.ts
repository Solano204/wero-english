import { useState } from 'react';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import * as notifications from '@/services/notificaciones';
import { sinEsperar } from '@/services/fallas';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';
import {
  destinoSiguiente,
  indicePaso,
  leerBorrador,
  pasoAnterior,
  puedeAvanzar,
  puedeSaltarA,
  valoresContestados,
  valoresFinales,
  type BorradorPerfil,
  type PasoPerfil,
  type RespuestasPerfil,
} from '@/domain/perfilInicial';
import { useShallow } from 'zustand/react/shallow';

export type PasoOnboarding = 'intro' | PasoPerfil;
export type Direccion = 'adelante' | 'atras';

/**
 * Los primeros pasos: la presentación, las preguntas del perfil y el resumen.
 *
 * Las respuestas viven en memoria y en un borrador (ajuste `onboardingBorrador`) mientras contesta: se puede
 * regresar, cambiar una respuesta y seguir sin perder las demás, y si cierra la app continúa donde iba. El perfil
 * (filtro de lenguaje y avisos) se guarda al final, en una sola transacción, al tocar «Listo».
 */
export function usePrimerosPasos() {
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore(
    useShallow((st) => ({
      niveles: st.niveles,
      horaNotificacion: st.horaNotificacion,
      notifDesde: st.notifDesde,
      notifHasta: st.notifHasta,
      notifPorDia: st.notifPorDia,
      onboardingBorrador: st.onboardingBorrador,
      set: st.set,
      setVarios: st.setVarios,
    }))
  );
  const [inicial] = useState(() => leerBorrador(settings.onboardingBorrador));
  const [paso, setPaso] = useState<PasoOnboarding>(inicial?.paso ?? 'intro');
  const [respuestas, setRespuestas] = useState<RespuestasPerfil>(
    inicial?.respuestas ?? { limpio: null, porDia: settings.notifPorDia, desde: settings.notifDesde, hasta: settings.notifHasta }
  );
  const [alcanzado, setAlcanzado] = useState(inicial?.alcanzado ?? 0);
  const [volverAlResumen, setVolverAlResumen] = useState(false);
  const [direccion, setDireccion] = useState<Direccion>('adelante');
  const [slide, setSlide] = useState(0);
  const [permisoNegado, setPermisoNegado] = useState(false);
  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();
  // En Expo Go no hay notificaciones desde el SDK 53. Se dice tal cual
  // en vez de fingir que el usuario negó un permiso que nunca se pidió.
  const notifEstado = notifications.isAvailable();

  const guardarBorrador = (b: BorradorPerfil) => {
    if (user) sinEsperar(settings.set(user.id, 'onboardingBorrador', b), 'ajustes:borrador');
  };

  const mover = (destino: PasoOnboarding, dir: Direccion, r: RespuestasPerfil, alc: number) => {
    setDireccion(dir);
    setPaso(destino);
    if (destino !== 'intro') guardarBorrador({ paso: destino, alcanzado: alc, respuestas: r });
  };

  const actualizar = (r: RespuestasPerfil) => {
    setRespuestas(r);
    if (paso !== 'intro') guardarBorrador({ paso, alcanzado, respuestas: r });
  };

  const empezar = () => mover('p1', 'adelante', respuestas, alcanzado);
  const elegirLimpio = (v: unknown) => actualizar({ ...respuestas, limpio: Boolean(v) });
  const cambiarPorDia = (n: number) => actualizar({ ...respuestas, porDia: n });
  const cambiarVentana = (desde: string, hasta: string) => actualizar({ ...respuestas, desde, hasta });

  const siguiente = () => {
    if (paso === 'intro' || paso === 'resumen' || !puedeAvanzar(respuestas, paso)) return;
    const destino = destinoSiguiente(paso, volverAlResumen);
    const alc = Math.max(alcanzado, indicePaso(destino));
    setAlcanzado(alc);
    setVolverAlResumen(false);
    mover(destino, 'adelante', respuestas, alc);
  };

  /** Regresa un paso (o al resumen, si venía de «Cambiar»). En la primera pregunta no hace nada: la pantalla pregunta si sale. */
  const atras = () => {
    if (paso === 'intro' || paso === 'p1') return;
    const destino = volverAlResumen ? 'resumen' : pasoAnterior(paso);
    setVolverAlResumen(false);
    mover(destino, 'atras', respuestas, alcanzado);
  };

  const irA = (destino: PasoPerfil) => {
    if (paso === 'intro' || destino === paso || !puedeSaltarA(alcanzado, destino)) return;
    setVolverAlResumen(false);
    mover(destino, indicePaso(destino) > indicePaso(paso) ? 'adelante' : 'atras', respuestas, alcanzado);
  };

  const cambiarDesdeResumen = (destino: PasoPerfil) => {
    setVolverAlResumen(true);
    mover(destino, 'atras', respuestas, alcanzado);
  };

  /** Una sola transacción: el perfil, el interruptor de avisos (si ya se decidió) y el fin del onboarding. */
  const aplicarYSalir = async (notificaciones?: boolean) => {
    if (!user) return;
    await settings.setVarios(user.id, {
      ...valoresFinales(respuestas),
      ...(notificaciones === undefined ? {} : { notificaciones }),
      onboardingBorrador: null,
      onboardingHecho: true,
    });
  };

  const terminar = () => aplicarYSalir(permisoNegado ? false : undefined);

  // Saltar guarda lo que ya contestó y deja lo demás como estaba. Nunca se atrapa a nadie en el onboarding.
  const saltarTodo = async () => {
    if (!user) return;
    await settings.setVarios(user.id, {
      ...valoresContestados(respuestas, alcanzado),
      onboardingBorrador: null,
      onboardingHecho: true,
    });
  };

  const pedirNotificaciones = async () => {
    if (!user) return;
    if (!notifEstado.ok) {
      await aplicarYSalir();
      return;
    }
    // Primero la hoja que explica cuáles y cada cuánto; «Ahora no» sigue sin recordatorios.
    if (!(await pedirConsentimiento('notificaciones'))) {
      await aplicarYSalir(false);
      return;
    }
    const ok = await notifications.requestPermission();
    if (!ok) {
      setPermisoNegado(true);
      return;
    }
    const v = valoresFinales(respuestas);
    await notifications.setupChannel();
    await notifications.scheduleNext({
      usuarioId: user.id,
      config: loadContent().notificaciones,
      filter: { modoLimpio: v.modoLimpio, niveles: settings.niveles },
      hora: settings.horaNotificacion,
      racha: 0,
      porDia: v.notifPorDia,
      desde: v.notifDesde,
      hasta: v.notifHasta,
    });
    await aplicarYSalir(true);
  };

  return {
    paso,
    direccion,
    respuestas,
    alcanzado,
    slide,
    setSlide,
    permisoNegado,
    notifEstado,
    hoja,
    empezar,
    elegirLimpio,
    cambiarPorDia,
    cambiarVentana,
    siguiente,
    atras,
    irA,
    cambiarDesdeResumen,
    terminar,
    saltarTodo,
    pedirNotificaciones,
  };
}
