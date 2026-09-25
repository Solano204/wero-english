import React, { useCallback, useEffect, useRef, useState } from 'react';
import { plural } from '@/utils/text';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import {
  Button,
  EmptyState,
  Header,
  IconButton,
  Screen,
} from '@/components/base';
import { Confetti, Trozos, useReaccion } from '@/components/feedback';
import { BarraSesion, ChipMarcador, HojaVeredicto, publicarBarraEstudio } from '@/components/fx';
import { DiffFrase, StudyCardView } from '@/components/card';
import { nivelSeguidas } from '@/domain/seguidas';
import { sesionMerece } from '@/domain/session';
import { useAuthStore, useSessionStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as notifications from '@/services/notifications';
import { aparecerSubiendo, color, font, layout, motionDuration, space } from '@/theme';
import type { StudyCard } from '@/types';
import { useMovimientoReducido } from '@/utils';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Lo que dejó la sesión al terminar: para la línea final y para decidir si hay celebración. */
interface Cierre {
  aciertos: number;
  total: number;
  merece: boolean;
}

/**
 * El momento del final: la barra se llena, la luz la recorre una vez y entra la
 * línea de resumen. Después se vuelve, sin pared entre el usuario y la salida.
 */
const FIN_SESION_MS = motionDuration.escena + motionDuration.base;

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
  const reducido = useMovimientoReducido();
  const nav = useNavigation<Nav>();
  const barra = useRef<View>(null);
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore();
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
  } = useSessionStore();

  const [chosen, setChosen] = useState<string | null>(null);
  // Al terminar una sesión completa con vencidas pendientes se ofrece seguir.
  const [cierre, setCierre] = useState(false);
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
    void start(user.id, settings.filter(), settings.metaDiaria, settings.nuevasPorDia);
    return () => reset();
    // Se arranca una sola vez al montar: las dependencias completas
    // reiniciarían la sesión cada vez que cambie un ajuste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Al terminar se vuelve, y ya.
   *
   * Antes esto abría "Listo por hoy": una pantalla entera para decir
   * "0 respondidas, 0%". Cuando la sesión sí valió la pena, el número
   * que importa ya está en Progreso, y cuando no, era una pared entre
   * el usuario y la salida. Ahora es un momento corto: la barra se llena,
   * la luz la recorre y una línea dice cuántas atinaste (con fiesta solo si
   * la sesión fue buena). Con vencidas pendientes se ofrece seguir.
   *
   * Al llegar al final con «Siguiente» la sesión nunca se cerraba: no se
   * guardaba la racha ni el fin de la sesión ni se programaba la próxima
   * notificación (solo pasaba al salir con la flecha). Se cierra aquí.
   */
  useEffect(() => {
    if (phase !== 'finished') return;

    const estado = useSessionStore.getState();
    const resumen = estado.summary;

    if (!resumen) {
      if (user && !cerrada.current) {
        cerrada.current = true;
        finish(user.id).catch(() => nav.goBack());
        return;
      }
      nav.goBack();
      return;
    }

    if (user && resumen.total > 0 && settings.notificaciones && settings.notifPorDia > 0) {
      void notifications.requestPermission().then((ok) => {
        if (!ok) return;
        void notifications.scheduleNext({
          usuarioId: user.id,
          config: loadContent().notificaciones,
          filter: settings.filter(),
          hora: settings.horaNotificacion,
          racha: resumen.streak ?? 0,
          porDia: settings.notifPorDia,
          desde: settings.notifDesde,
          hasta: settings.notifHasta,
        });
      });
    }

    setFin(
      resumen.total > 0
        ? { aciertos: resumen.correct, total: resumen.total, merece: sesionMerece(resumen.correct, resumen.total) }
        : null
    );

    if (estado.pendientes > 0) {
      setCierre(true);
      return;
    }

    // Salir con la flecha o no haber respondido nada: sin momento final.
    if (salidaManual.current || resumen.total === 0) {
      nav.goBack();
      return;
    }
    const t = setTimeout(() => nav.goBack(), FIN_SESION_MS);
    return () => clearTimeout(t);
  }, [phase, nav, user, settings, finish]);

  const seguirRepasando = useCallback(() => {
    if (!user) return;
    setCierre(false);
    setFin(null);
    cerrada.current = false;
    salidaManual.current = false;
    void start(user.id, settings.filter(), settings.metaDiaria, settings.nuevasPorDia);
  }, [user, start, settings]);

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
    // Ya terminó y se está viendo el momento final: la flecha sale de una vez.
    if (phase === 'finished') {
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

  if (phase === 'loading' || phase === 'idle') {
    return (
      <Screen>
        <Header onClose={() => nav.goBack()} />
        <View style={styles.center}>
          <Text style={styles.loading}>Armando tu sesión…</Text>
        </View>
      </Screen>
    );
  }

  if (phase === 'empty') {
    return (
      <Screen>
        <Header onClose={() => nav.goBack()} />
        <EmptyState
          icon="check"
          title="Ya repasaste todo por hoy"
          body="Vuelve mañana."
          actionLabel="Ir a Practicar"
          onAction={() => nav.popTo('Main', { screen: 'Practice' })}
        />
      </Screen>
    );
  }

  if (phase === 'finished' && cierre) {
    return (
      <Screen>
        <Confetti active={Boolean(fin?.merece)} />
        <Animated.View entering={reducido ? undefined : aparecerSubiendo()} style={styles.cierre}>
          <Text style={styles.cierreTitulo}>Sesión terminada</Text>
          {fin ? <Text style={styles.cierreLinea}>{lineaFinal(fin)}</Text> : null}
          <Button label="Terminar" full onPress={() => nav.goBack()} />
          <Button
            label={`Seguir repasando (${pendientes} restantes)`}
            variant="secondary"
            full
            onPress={seguirRepasando}
          />
        </Animated.View>
      </Screen>
    );
  }

  const terminada = phase === 'finished';
  if (!card && !terminada) return null;

  return (
    <Screen padded={false}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  cierre: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
});
