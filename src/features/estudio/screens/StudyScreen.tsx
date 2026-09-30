import React, { useCallback, useEffect, useRef, useState } from 'react';
import { plural } from '@/domain/texto';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import {
  Button,
  ErrorCarga,
  Header,
  IconButton,
  Screen,
} from '@/shared/ui';
import { FinDelDia } from '@/features/estudio/components/FinDelDia';
import { Confetti } from '@/shared/ui/feedback/Confetti';
import { Trozos } from '@/shared/ui/feedback/Trozos';
import { useReaccion } from '@/shared/hooks/useReaccion';
import { BarraSesion } from '@/shared/ui/fx/BarraSesion';
import { ChipMarcador } from '@/features/estudio/components/ChipMarcador';
import { HojaVeredicto } from '@/features/estudio/components/HojaVeredicto';
import { publicarBarraEstudio } from '@/shared/ui/fx/estadoTransicion';
import { DiffFrase } from '@/features/estudio/components/DiffFrase';
import { StudyCardView } from '@/features/estudio/components/StudyCardView';
import { Hueso, HuesoBoton, HuesoImagen, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { nivelSeguidas } from '@/domain/seguidas';
import { sesionMerece } from '@/domain/session';
import { DEMORA_ESQUELETO_MS, MINIMO_ESQUELETO_MS } from '@/shared/hooks/useCarga';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSessionStore } from '@/features/estudio/hooks/useSessionStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as notifications from '@/services/notificaciones';
import { aparecerSubiendo, color, font, layout, radius, space } from '@/theme';
import type { StudyCard } from '@/types';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Lo que dejó la sesión al terminar: para la línea final y para decidir si hay celebración. */
interface Cierre {
  aciertos: number;
  total: number;
  merece: boolean;
}

const lineaFinal = (c: Cierre) => `${c.aciertos} de ${c.total} ${plural(c.total, 'frase atinada', 'frases atinadas')}`;

/**
 * P-05, la sesión de estudio. La pantalla más importante de la app.
 *
 * Mantiene la pantalla encendida: una sesión de tres minutos con audio
 * puede pasar de los quince segundos de inactividad de Android y se
 * apaga a media tarjeta.
 */
export function StudyScreen() {
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
  const ultimaTarjeta = useRef<StudyCard | null>(null);
  if (card) ultimaTarjeta.current = card;

  // Cubitos al responder. Salen de la opción acertada; sin opción (armar, escribir) del centro.
  const reaccion = useReaccion();
  const [origenTrozos, setOrigenTrozos] = useState<{ x: number; y: number } | null>(null);

  // Misma pista que el resto de la app, pero más baja: aquí se estudia.
  useMusicaPantalla('app', { volumenFactor: 0.4 });

  useEffect(() => {
    if (!user) return;
    void start(user.id, settings.filter(), settings.metaDiaria, settings.nuevasPorDia, {
      soloNuevas: params?.modo === 'nuevas',
    });
    return () => reset();
    // Se arranca una sola vez al montar: las dependencias completas
    // reiniciarían la sesión cada vez que cambie un ajuste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const otraSesion = useCallback(
    (soloNuevas: boolean) => {
      if (!user) return;
      setMostrarFin(false);
      setFin(null);
      cerrada.current = false;
      salidaManual.current = false;
      void start(user.id, settings.filter(), settings.metaDiaria, settings.nuevasPorDia, { soloNuevas });
    },
    [user, start, settings]
  );
  const seguirRepasando = useCallback(() => otraSesion(false), [otraSesion]);
  const aprenderNuevas = useCallback(() => otraSesion(true), [otraSesion]);

  // El botón físico de atrás cierra la sesión igual que la X.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleClose();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, phase]);

  const handleClose = useCallback(async () => {
    // Ya terminó, no había nada que armar o falló al armarse: la flecha sale de una vez.
    if (phase !== 'active') {
      nav.goBack();
      return;
    }
    if (!user) return;
    salidaManual.current = true;
    cerrada.current = true;
    await finish(user.id);
  }, [user, finish, phase, nav]);

  const handleAnswer = useCallback(
    async (correct: boolean, elapsedMs: number, usedHint: boolean) => {
      if (!user) return;
      if (correct) reaccion.celebra();
      await answer(user.id, correct, elapsedMs, usedHint);
    },
    [user, answer]
  );

  const handleContinue = useCallback(() => {
    setChosen(null);
    setOrigenTrozos(null);
    next();
  }, [next]);

  if (phase === 'loading' || phase === 'idle' || demoraSesion) {
    return (
      <Screen transicionCarga={demoraSesion ? 'esqueleto' : undefined}>
        <Header onClose={() => nav.goBack()} />
        {demoraSesion ? (
          <ProveedorEsqueleto etiqueta="Armando tu sesión" style={styles.esqueletoRaiz}>
            <Hueso width="100%" height={6} radius={radius.pill} />
            <HuesoImagen style={styles.esqueletoImagen} />
            <View style={styles.esqueletoTexto}>
              <Hueso width="75%" height={24} style={styles.esqueletoCentrado} />
              <Hueso width="45%" height={16} style={styles.esqueletoCentrado} />
            </View>
            <View style={styles.esqueletoOpciones}>
              {Array.from({ length: 4 }, (_, i) => (
                <HuesoBoton key={i} size="lg" />
              ))}
            </View>
          </ProveedorEsqueleto>
        ) : null}
      </Screen>
    );
  }

  if (phase === 'error') {
    return (
      <Screen>
        <Header onClose={() => nav.goBack()} />
        <ErrorCarga onReintentar={() => otraSesion(params?.modo === 'nuevas')} />
      </Screen>
    );
  }

  // Sin nada que repasar, o la sesión ya terminó: el estado final. Nunca una pantalla vacía.
  if (phase === 'empty' || (phase === 'finished' && mostrarFin)) {
    return (
      <Screen>
        <Confetti active={phase === 'finished' && Boolean(fin?.merece)} />
        <Header onClose={() => nav.goBack()} />
        <FinDelDia
          resumen={phase === 'finished' ? summary : null}
          pendientes={phase === 'finished' ? pendientes : 0}
          proximoRepaso={proximoRepaso}
          nuevasCatalogo={nuevasCatalogo}
          onSeguirRepasando={seguirRepasando}
          onAprenderNuevas={aprenderNuevas}
          onJugar={() => nav.popTo('Main', { screen: 'Practice' })}
          onFrasesSueltas={() => nav.replace('Azar', undefined)}
          onVolver={() => nav.goBack()}
        />
      </Screen>
    );
  }

  const terminada = phase === 'finished';
  // Nunca en blanco: si por lo que sea no hay tarjeta y la sesión no terminó, queda la salida.
  if (!card && !terminada) {
    return (
      <Screen>
        <Header onClose={() => nav.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} transicionCarga={huboEsqueleto ? 'contenido' : undefined}>
      <Trozos disparo={reaccion.trozos} tinte={color.accent} y="46%" origen={origenTrozos ?? undefined} />
      <Confetti active={terminada && Boolean(fin?.merece)} />
      <View style={styles.top}>
        {/*
          * Fila de arriba: atrás a la izquierda, "Saltar" a la derecha y en
          * medio los chips de la sesión. Los dos chips no caben junto a la
          * barra a 360 px (quedaba de ~40 dp), así que la barra va debajo, a
          * todo el ancho. Ninguno de los dos se guarda ni se menciona al
          * caerse: son un gusto pequeño mientras dura la sesión, no una deuda.
          */}
        <View style={styles.filaSuperior}>
          <IconButton icono="back" etiqueta="Atrás" tamano="sm" onPress={handleClose} />
          <View style={styles.chips}>
            {aciertos > 0 ? (
              <ChipMarcador
                valor={aciertos}
                sufijo={plural(aciertos, 'atinada', 'atinadas')}
                tinte={color.accent}
                etiqueta={`${aciertos} ${plural(aciertos, 'frase atinada', 'frases atinadas')}`}
              />
            ) : null}
            {settings.mostrarSeguidas && nivelSeguidas(seguidas) > 0 ? (
              <ChipMarcador valor={seguidas} icono="fire" tinte={color.star} etiqueta={`${seguidas} seguidas`} />
            ) : null}
          </View>
          <Button
            label="Saltar"
            variant="ghost"
            disabled={avanzando || terminada}
            onPress={() => {
              setChosen(null);
              setOrigenTrozos(null);
              skip();
            }}
          />
        </View>

        <View
          ref={barra}
          collapsable={false}
          style={styles.barRow}
          onLayout={() => barra.current?.measureInWindow((_x, y, _w, alto) => publicarBarraEstudio(y + alto / 2))}
        >
          {/* Al terminar la barra se llena (aunque hayas saltado alguna) y la luz la recorre una vez. */}
          <BarraSesion
            hecho={terminada ? goal : done}
            meta={goal}
            seguidas={settings.mostrarSeguidas && !terminada ? seguidas : 0}
            barrido={terminada}
          />
        </View>
      </View>

      <View style={styles.body}>
        {card ? (
          <StudyCardView
            key={`${card.entry.id}-${card.kind}`}
            card={card}
            locked={Boolean(feedback)}
            chosen={chosen}
            autoAudio={settings.autoAudio}
            onChoose={setChosen}
            onAnswer={handleAnswer}
            onOrigenAcierto={setOrigenTrozos}
          />
        ) : fin ? (
          <Animated.View
            entering={reducido ? undefined : aparecerSubiendo()}
            style={styles.finCentro}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.cierreTitulo}>Sesión terminada</Text>
            <Text style={styles.cierreLinea}>{lineaFinal(fin)}</Text>
          </Animated.View>
        ) : null}
      </View>

      {ultimaTarjeta.current ? (
        <HojaVeredicto
          visible={Boolean(feedback)}
          correct={feedback?.correct ?? false}
          answer={feedback?.answer ?? ''}
          nota={feedback?.nota}
          repaso={feedback?.nextLabel}
          frase={
            // Dictado y Escribir: la frase con lo que faltó y lo que sobró marcado en su lugar.
            feedback &&
            !feedback.correct &&
            (ultimaTarjeta.current.kind === 'dictado' || ultimaTarjeta.current.kind === 'escribir') &&
            chosen ? (
              <DiffFrase dado={chosen} esperado={feedback.answer} />
            ) : undefined
          }
          avanzando={avanzando}
          onContinue={handleContinue}
          onDetail={() => {
            const abierta = ultimaTarjeta.current;
            if (abierta) nav.navigate('Detail', { entryId: abierta.entry.id });
          }}
        />
      ) : null}
      {hoja}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cierreTitulo: {
    fontFamily: font.family.heading,
    fontSize: font.size.xl,
    color: color.text,
    textAlign: 'center',
  },
  cierreLinea: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
    marginBottom: space.md,
  },
  finCentro: { flex: 1, justifyContent: 'center', gap: space.sm },
  top: { paddingHorizontal: space.lg, paddingTop: space.xs },
  filaSuperior: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tapMin },
  chips: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barRow: { marginBottom: space.xs },
  body: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.md },
  esqueletoRaiz: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xl },
  esqueletoImagen: { marginTop: space.md },
  esqueletoTexto: { gap: space.sm, alignItems: 'center' },
  esqueletoCentrado: { alignSelf: 'center' },
  esqueletoOpciones: { gap: space.sm },
});
