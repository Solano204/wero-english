import React, { useCallback, useEffect, useRef, useState } from 'react';
import { plural } from '@/utils/text';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import {
  Button,
  EmptyState,
  Header,
  ProgressBar,
  Screen,
} from '@/components/base';
import { Trozos, useReaccion } from '@/components/feedback';
import { publicarBarraEstudio } from '@/components/fx';
import { FeedbackBand, StudyCardView } from '@/components/card';
import { useAuthStore, useSessionStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as notifications from '@/services/notifications';
import { color, font, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * P-05, la sesión de estudio. La pantalla más importante de la app.
 *
 * Mantiene la pantalla encendida: una sesión de tres minutos con audio
 * puede pasar de los quince segundos de inactividad de Android y se
 * apaga a media tarjeta.
 */
export function StudyScreen() {
  useKeepAwake();
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

  // Cara y cubitos al responder.
  const reaccion = useReaccion();

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
   * el usuario y la salida.
   *
   * Lo único que esa pantalla hacía además de mostrarse era programar la
   * siguiente notificación. Eso se hace aquí, que es donde de verdad
   * termina la sesión.
   */
  useEffect(() => {
    if (phase !== 'finished') return;

    const resumen = useSessionStore.getState().summary;
    if (user && resumen && resumen.total > 0 && settings.notificaciones && settings.notifPorDia > 0) {
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

    if (useSessionStore.getState().pendientes > 0) {
      setCierre(true);
      return;
    }

    nav.goBack();
  }, [phase, nav, user, settings]);

  const seguirRepasando = useCallback(() => {
    if (!user) return;
    setCierre(false);
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
  }, [user]);

  const handleClose = useCallback(async () => {
    if (!user) return;
    await finish(user.id);
  }, [user, finish]);

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
        <View style={styles.cierre}>
          <Text style={styles.cierreTitulo}>Sesión terminada</Text>
          <Button label="Terminar" full onPress={() => nav.goBack()} />
          <Button
            label={`Seguir repasando (${pendientes} restantes)`}
            variant="secondary"
            full
            onPress={seguirRepasando}
          />
        </View>
      </Screen>
    );
  }

  if (!card) return null;

  return (
    <Screen padded={false}>
      <Trozos disparo={reaccion.trozos} tinte={color.accent} y="46%" />
      <View style={styles.top}>
        {/*
          * La flecha va a la IZQUIERDA y "Saltar" a la derecha.
          *
          * Antes las dos peleaban por el mismo hueco: Header pinta
          * `right ?? onClose`, así que al pasar `right` el botón de
          * salir simplemente no existía. No había forma de volver.
          */}
        <Header
          onBack={handleClose}
          right={
            <Button
              label="Saltar"
              variant="ghost"
              disabled={avanzando}
              onPress={() => {
                setChosen(null);
                skip();
              }}
            />
          }
        />
        {/* El contador de seguidas vive solo mientras dura la sesión.
            No se guarda, no aparece en Progreso y no hay mensaje cuando
            se cae: es un gusto pequeño, no una deuda. */}
        {settings.mostrarSeguidas && seguidas >= 3 ? (
          <Text style={styles.seguidas}>{seguidas} seguidas</Text>
        ) : null}

        <View
          ref={barra}
          collapsable={false}
          style={styles.barRow}
          onLayout={() => barra.current?.measureInWindow((_x, y, _w, alto) => publicarBarraEstudio(y + alto / 2))}
        >
          <ProgressBar value={done} total={goal} />
          <Text style={styles.counter}>
            {done}/{goal}
          </Text>
        </View>

        {/* Aciertos de la sesión. Sube en cuanto le atinas a una frase,
            que es el momento en que el número significa algo. Va en
            acento porque es lo único de la barra que celebra. */}
        <View style={styles.aciertosRow}>
          <Text style={styles.aciertosNum}>{aciertos}</Text>
          <Text style={styles.aciertosTxt}>
            {plural(aciertos, 'frase atinada', 'frases atinadas')}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <StudyCardView
          key={`${card.entry.id}-${card.kind}`}
          card={card}
          locked={Boolean(feedback)}
          chosen={chosen}
          autoAudio={settings.autoAudio}
          onChoose={setChosen}
          onAnswer={handleAnswer}
        />
      </View>

      <FeedbackBand
        visible={Boolean(feedback)}
        correct={feedback?.correct ?? false}
        answer={feedback?.answer ?? ''}
        nota={feedback?.nota}
        nextLabel={feedback?.nextLabel}
        avanzando={avanzando}
        onContinue={handleContinue}
        onDetail={() => nav.navigate('Detail', { entryId: card.entry.id })}
      />
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
    marginBottom: space.md,
  },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  /*
   * Aciertos de la sesión.
   *
   * Va debajo de la barra y no dentro de ella: la barra dice cuánto
   * falta, y esto dice cuánto llevas bien. Son dos preguntas distintas y
   * mezclarlas en una sola fila hacía que no se leyera ninguna.
   */
  aciertosRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
    marginTop: space.sm,
  },
  aciertosNum: {
    fontSize: font.size.lg,
    fontFamily: font.family.display,
    color: color.accent,
  },
  aciertosTxt: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  counter: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    minWidth: 44,
    textAlign: 'right',
  },
  seguidas: {
    fontSize: font.size.xs,
    color: color.star,
    fontFamily: font.family.bodyStrong,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  body: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
});
