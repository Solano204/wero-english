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
  IconButton,
  Screen,
} from '@/components/base';
import { Trozos, useReaccion } from '@/components/feedback';
import { BarraSesion, ChipMarcador, HojaVeredicto, publicarBarraEstudio } from '@/components/fx';
import { DiffFrase, StudyCardView } from '@/components/card';
import { useAuthStore, useSessionStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as notifications from '@/services/notifications';
import { color, font, layout, space } from '@/theme';
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
      <Trozos disparo={reaccion.trozos} tinte={color.accent} y="46%" origen={origenTrozos ?? undefined} />
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
            {settings.mostrarSeguidas && seguidas >= 3 ? (
              <ChipMarcador valor={seguidas} icono="fire" tinte={color.star} etiqueta={`${seguidas} seguidas`} />
            ) : null}
          </View>
          <Button
            label="Saltar"
            variant="ghost"
            disabled={avanzando}
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
          <BarraSesion hecho={done} meta={goal} />
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
          onOrigenAcierto={setOrigenTrozos}
        />
      </View>

      <HojaVeredicto
        visible={Boolean(feedback)}
        correct={feedback?.correct ?? false}
        answer={feedback?.answer ?? ''}
        nota={feedback?.nota}
        repaso={feedback?.nextLabel}
        frase={
          // Dictado y Escribir: la frase con lo que faltó y lo que sobró marcado en su lugar.
          feedback && !feedback.correct && (card.kind === 'dictado' || card.kind === 'escribir') && chosen ? (
            <DiffFrase dado={chosen} esperado={feedback.answer} />
          ) : undefined
        }
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
  top: { paddingHorizontal: space.lg, paddingTop: space.xs },
  filaSuperior: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tapMin },
  chips: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barRow: { marginBottom: space.xs },
  body: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
});
