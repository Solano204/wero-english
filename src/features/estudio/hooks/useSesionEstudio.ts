import { useEffect, useRef, useState, useEffectEvent } from 'react';
import { BackHandler, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { useReaccion } from '@/shared/hooks/useReaccion';
import { sesionMerece } from '@/domain/session';
import { DEMORA_ESQUELETO_MS, MINIMO_ESQUELETO_MS } from '@/shared/hooks/useCarga';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';
import { useShallow } from 'zustand/react/shallow';
import { useUltimo } from '@/shared/hooks/useUltimo';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSessionStore } from '@/features/estudio/hooks/useSessionStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as notifications from '@/services/notificaciones';
import type { StudyCard } from '@/types';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Lo que dejó la sesión al terminar: para la línea final y para decidir si hay celebración. */
export interface Cierre {
  aciertos: number;
  total: number;
  merece: boolean;
}

/**
 * La sesión de Estudio en la pantalla: arranque, tarjeta actual, respuesta, veredicto y fin.
 */
export function useSesionEstudio() {
  useKeepAwake();
  useCortarAudioAlSalir();
  const reducido = useMovimientoReducido();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<RootStackParams, 'Study'>>();
  const barra = useRef<View>(null);
  const user = useAuthStore((s) => s.user);
  // Con selector y comparación superficial: sin ellos la pantalla entera se repintaba con
  // cualquier cambio de los stores, incluso de campos que no lee (remaining, dueCount, summary).
  const settings = useSettingsStore(
    useShallow((s) => ({
      filter: s.filter,
      metaDiaria: s.metaDiaria,
      nuevasPorDia: s.nuevasPorDia,
      notificaciones: s.notificaciones,
      notifPorDia: s.notifPorDia,
      horaNotificacion: s.horaNotificacion,
      notifDesde: s.notifDesde,
      notifHasta: s.notifHasta,
      mostrarSeguidas: s.mostrarSeguidas,
      autoAudio: s.autoAudio,
    }))
  );
  const {
    phase,
    card,
    siguienteImagen,
    feedback,
    done,
    goal,
    seguidas,
    avanzando,
    start,
    answer,
    next,
    skip,
    finish,
    reset,
    aciertos,
    pendientes,
    summary,
    proximoRepaso,
    nuevasCatalogo,
  } = useSessionStore(
    useShallow((s) => ({
      phase: s.phase,
      card: s.card,
      siguienteImagen: s.siguienteImagen,
      feedback: s.feedback,
      done: s.done,
      goal: s.goal,
      seguidas: s.seguidas,
      avanzando: s.avanzando,
      start: s.start,
      answer: s.answer,
      next: s.next,
      skip: s.skip,
      finish: s.finish,
      reset: s.reset,
      aciertos: s.aciertos,
      pendientes: s.pendientes,
      summary: s.summary,
      proximoRepaso: s.proximoRepaso,
      nuevasCatalogo: s.nuevasCatalogo,
    }))
  );

  // El esqueleto de "armando tu sesión" solo aparece si tarda más de
  // DEMORA_ESQUELETO_MS (una sesión que arma rápido no debe parpadear) y,
  // si apareció, se queda al menos MINIMO_ESQUELETO_MS: las mismas reglas
  // que useCarga.
  const [demoraSesion, setDemoraSesion] = useState(false);
  const [huboEsqueleto, setHuboEsqueleto] = useState(false);
  const esqueletoDesde = useRef<number | null>(null);
  useEffect(() => {
    if (phase === 'loading' || phase === 'idle') {
      if (esqueletoDesde.current === null) setHuboEsqueleto(false);
      const t = setTimeout(() => {
        esqueletoDesde.current = Date.now();
        setDemoraSesion(true);
        setHuboEsqueleto(true);
      }, DEMORA_ESQUELETO_MS);
      return () => clearTimeout(t);
    }
    const desde = esqueletoDesde.current;
    if (desde === null) {
      setDemoraSesion(false);
      return undefined;
    }
    const t = setTimeout(() => {
      esqueletoDesde.current = null;
      setDemoraSesion(false);
    }, Math.max(0, MINIMO_ESQUELETO_MS - (Date.now() - desde)));
    return () => clearTimeout(t);
  }, [phase]);

  const [chosen, setChosen] = useState<string | null>(null);
  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();
  // Al terminar la sesión (sin salir con la flecha) se queda el estado final: «Terminaste por hoy».
  const [mostrarFin, setMostrarFin] = useState(false);
  const [fin, setFin] = useState<Cierre | null>(null);
  // finish() ya se pidió (lo pide la flecha o, al llegar al final, esta pantalla) y la salida fue con la flecha.
  const cerrada = useRef(false);
  const salidaManual = useRef(false);
  // La hoja de veredicto sigue en pantalla mientras sale, cuando ya no hay tarjeta.
  const ultimaTarjeta = useUltimo<StudyCard>(card);

  // Cubitos al responder. Salen de la opción acertada; sin opción (armar, escribir) del centro.
  const reaccion = useReaccion();
  const { celebra } = reaccion;
  const [origenTrozos, setOrigenTrozos] = useState<{ x: number; y: number } | null>(null);

  // Misma pista que el resto de la app, pero más baja: aquí se estudia.
  useMusicaPantalla('app', { volumenFactor: 0.4 });

  const alMontar = useEffectEvent(() => {
    if (!user) return;
    void start(user.id, settings.filter(), settings.metaDiaria, settings.nuevasPorDia, {
      soloNuevas: params?.modo === 'nuevas',
    });
    return () => reset();
    // Se arranca una sola vez al montar: las dependencias completas
    // reiniciarían la sesión cada vez que cambie un ajuste.
  });
  useEffect(() => alMontar(), []);

  /*
   * Al terminar.
   *
   * Al llegar al final con «Siguiente» la sesión se cierra aquí (racha, fin de la sesión y la
   * próxima notificación). El efecto depende también de `summary`: antes solo dependía de la fase,
   * y como `finish()` deja la fase igual ('finished') y solo agrega el resumen, el efecto no volvía
   * a correr: sin tarjeta y sin resumen, la pantalla se quedaba vacía y congelada. Ahora, cuando
   * llega el resumen, se muestra el estado final («Terminaste por hoy»); si se salió con la flecha,
   * se vuelve.
   */
  useEffect(() => {
    if (phase !== 'finished') return;

    if (!summary) {
      if (user && !cerrada.current) {
        cerrada.current = true;
        finish(user.id).catch(() => nav.goBack());
        return;
      }
      // Sin sesión que cerrar (se salió antes de armarla): se vuelve.
      if (!user || salidaManual.current) nav.goBack();
      return;
    }

    if (user && summary.total > 0 && settings.notificaciones && settings.notifPorDia > 0) {
      // Se pide solo, sin que la persona toque nada: primero la hoja que explica los avisos, y
      // si ya dijo «Ahora no» a esta versión del aviso, no se le vuelve a insistir.
      void pedirConsentimiento('notificaciones', { sinInsistir: true })
        .then((si) => (si ? notifications.requestPermission() : false))
        .then((ok) => {
        if (!ok) return;
        void notifications.scheduleNext({
          usuarioId: user.id,
          config: loadContent().notificaciones,
          filter: settings.filter(),
          hora: settings.horaNotificacion,
          racha: summary.streak ?? 0,
          porDia: settings.notifPorDia,
          desde: settings.notifDesde,
          hasta: settings.notifHasta,
        });
      });
    }

    setFin(
      summary.total > 0
        ? { aciertos: summary.correct, total: summary.total, merece: sesionMerece(summary.correct, summary.total) }
        : null
    );

    // Salir con la flecha: sin estado final, se vuelve.
    if (salidaManual.current) {
      nav.goBack();
      return;
    }
    setMostrarFin(true);
  }, [phase, summary, nav, user, settings, finish, pedirConsentimiento]);

  /** Otra sesión en la misma pantalla: la normal (seguir repasando) o la extra de solo nuevas. */
  const otraSesion = (soloNuevas: boolean) => {
    if (!user) return;
    setMostrarFin(false);
    setFin(null);
    cerrada.current = false;
    salidaManual.current = false;
    void start(user.id, settings.filter(), settings.metaDiaria, settings.nuevasPorDia, { soloNuevas });
  };
  const seguirRepasando = () => otraSesion(false);
  const aprenderNuevas = () => otraSesion(true);

  const handleClose = async () => {
    // Ya terminó, no había nada que armar o falló al armarse: la flecha sale de una vez.
    if (phase !== 'active') {
      nav.goBack();
      return;
    }
    if (!user) return;
    salidaManual.current = true;
    cerrada.current = true;
    await finish(user.id);
  };

  // El botón físico de atrás cierra la sesión igual que la X.
  const efectoUser = useEffectEvent(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleClose();
      return true;
    });
    return () => sub.remove();
  });
  useEffect(() => efectoUser(), [user, phase]);

  const handleAnswer = async (correct: boolean, elapsedMs: number, usedHint: boolean) => {
    if (!user) return;
    if (correct) celebra();
    await answer(user.id, correct, elapsedMs, usedHint);
  };

  const handleContinue = () => {
    setChosen(null);
    setOrigenTrozos(null);
    next();
  };

  return { reducido, nav, params, barra, settings, phase, card, siguienteImagen, feedback, done, goal, seguidas, avanzando, skip, aciertos, pendientes, summary, proximoRepaso, nuevasCatalogo, demoraSesion, huboEsqueleto, chosen, setChosen, hoja, mostrarFin, fin, ultimaTarjeta, reaccion, origenTrozos, setOrigenTrozos, otraSesion, seguirRepasando, aprenderNuevas, handleClose, handleAnswer, handleContinue };
}
