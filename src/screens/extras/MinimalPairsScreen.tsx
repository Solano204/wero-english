import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import {
  Button,
  Card,
  EmptyState,
  Header,
  ProgressBar,
  Screen,
} from '@/components/base';
import { AudioButton } from '@/components/card';
import { buildRounds, explicar, juzgar } from '@/domain/minimalPairs';
import { logHabla } from '@/db/economy';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import * as speech from '@/services/speech';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, radius, space, aparecer } from '@/theme';
import type { HablaVeredicto, ParMinimoRound } from '@/types';
import type { RootStackParams } from '@/navigation/routes';
import { useEfectoResultado } from '@/components/feedback';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * P-10b, "Di la palabra".
 *
 * El reconocedor del teléfono devuelve texto, no una calificación de
 * acento. Así que aquí no se califica el acento: se decide cuál de dos
 * palabras salió. Es lo único que un reconocedor general hace bien, y
 * resulta que es justo el error que le importa a un hispanohablante:
 * beach contra bitch, sheet contra shit, ice contra eyes.
 *
 * Nada de esto bloquea nada. Si el teléfono no entiende, no se
 * registra un fallo: se dice que no se entendió y se vuelve a intentar.
 */
export function MinimalPairsScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const micHabilitado = useSettingsStore((s) => s.micHabilitado);
  const setSetting = useSettingsStore((s) => s.set);

  const content = useMemo(loadContent, []);
  const estado = useMemo(() => speech.isAvailable(), []);

  const [rounds] = useState<ParMinimoRound[]>(() =>
    buildRounds(content.fonemas.fonemas)
  );
  const [idx, setIdx] = useState(0);
  const [escuchando, setEscuchando] = useState(false);
  const [veredicto, setVeredicto] = useState<HablaVeredicto | null>(null);
  const efecto = useEfectoResultado();
  const { disparar } = efecto;

  useEffect(() => {
    if (!veredicto) return;
    disparar(veredicto.tipo === 'acierto' ? 'acierto' : veredicto.tipo === 'confusa' ? 'fallo' : null);
  }, [veredicto, disparar]);
  const [aciertos, setAciertos] = useState(0);
  const [fallidos, setFallidos] = useState(0);

  const round = rounds[idx];

  useEffect(() => {
    return () => speech.cancel();
  }, []);

  const escuchar = useCallback(async () => {
    if (!round || escuchando) return;

    if (!micHabilitado) {
      const ok = await speech.requestPermission();
      if (!ok) {
        setVeredicto({
          tipo: 'no_disponible',
          razon: 'Sin permiso de micrófono no se puede escuchar. Se activa en los ajustes del teléfono.',
        });
        return;
      }
      if (user) await setSetting(user.id, 'micHabilitado', true);
    }

    setEscuchando(true);
    setVeredicto(null);

    const oido = await speech.listenOnce({
      candidatos: [round.objetivo, round.confusa],
    });

    const v = juzgar(round, oido);
    setEscuchando(false);
    setVeredicto(v);

    if (v.tipo === 'acierto') {
      haptics.success();
      void audio.playSuccess();
      setAciertos((a) => a + 1);
      setFallidos(0);
    } else if (v.tipo === 'confusa') {
      haptics.failure();
      void audio.playFail();
      setFallidos(0);
    } else {
      // Ni acierto ni error del usuario: el reconocedor no entendió.
      // No se cuenta como fallo y no se escribe en el registro.
      setFallidos((f) => f + 1);
    }

    if (user && (v.tipo === 'acierto' || v.tipo === 'confusa')) {
      await logHabla(
        user.id,
        round.id,
        round.objetivo,
        v.oido,
        v.tipo === 'acierto'
      );
    }
  }, [round, escuchando, micHabilitado, user, setSetting]);

  const siguiente = useCallback(() => {
    setVeredicto(null);
    setFallidos(0);
    if (idx + 1 >= rounds.length) {
      nav.replace('GameEnd', {
        juego: 'pares_minimos',
        rondas: rounds.length,
        aciertos,
      });
      return;
    }
    setIdx((i) => i + 1);
  }, [idx, rounds.length, aciertos, nav]);

  if (!estado.ok) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Di la palabra" />
        <EmptyState
          icon="mic-off"
          title="Aquí todavía no hay micrófono"
          body={`${estado.razon} Mientras tanto, el laboratorio de sonidos funciona igual: escuchas el modelo y repites en voz alta.`}
          actionLabel="Ir al laboratorio de sonidos"
          onAction={() => nav.replace('Pronunciation', undefined)}
        />
      </Screen>
    );
  }

  if (rounds.length === 0 || !round) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Di la palabra" />
        <EmptyState
          icon="warning"
          title="Faltan los pares mínimos"
          body="El archivo fonemas.json no trae pares cargados todavía."
        />
      </Screen>
    );
  }

  const exp = veredicto ? explicar(round, veredicto) : null;
  const acerto = veredicto?.tipo === 'acierto';

  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <Header
          onBack={() => nav.goBack()}
          right={
            <Text style={styles.contador}>
              {idx + 1} de {rounds.length}
            </Text>
          }
        />
        <ProgressBar value={idx} total={rounds.length} />
      </View>

      <View style={styles.body}>
        <Text style={styles.instruccion}>Di esta palabra</Text>
        <Text style={styles.palabra}>{round.objetivo}</Text>
        <Text style={styles.significado}>{round.objetivoEs}</Text>
        <AudioButton
          path={round.audioObjetivo}
          size="md"
          label="Escuchar el modelo"
        />

        <Card style={styles.contraste}>
          <Text style={styles.contrasteTexto}>
            No vaya a sonar como <Text style={styles.confusa}>{round.confusa}</Text>
            {round.confusaEs ? ` (${round.confusaEs})` : ''}
          </Text>
        </Card>

        {exp ? (
          <Animated.View entering={aparecer()} style={styles.resultado}>
            <Animated.View style={efecto.estilo}>
              <Card
                style={styles.resultadoCard}
              >
                <Text
                  style={[
                    styles.resultadoTitulo,
                    { color: acerto ? color.correct : color.wrong },
                  ]}
                >
                  {exp.titulo}
                </Text>
                <Text style={styles.resultadoCuerpo}>{exp.cuerpo}</Text>
              </Card>
            </Animated.View>

            {fallidos >= 3 ? (
              <Text style={styles.rendicion}>
                Si el teléfono no te agarra el audio, puedes seguir sin
                micrófono desde el laboratorio de sonidos.
              </Text>
            ) : null}
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.pie}>
        <Button
          label={escuchando ? 'Escuchando…' : 'Mantén para hablar'}
          onPress={escuchar}
          loading={escuchando}
          full
          size="lg"
        />
        {veredicto ? (
          <Button
            icon={idx + 1 >= rounds.length ? 'check' : 'arrow-right'}
            accessibilityLabel={
              idx + 1 >= rounds.length ? 'Terminar' : 'Siguiente'
            }
            variant="secondary"
            onPress={siguiente}
            full
          />
        ) : null}
        <Text style={styles.privacidad}>
          El audio no sale de tu teléfono. No se graba nada.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  contador: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  body: {
    flex: 1,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.lg,
  },
  instruccion: {
    fontSize: font.size.xs,
    color: color.textFaint,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: font.family.bodyStrong,
  },
  palabra: {
    fontSize: font.size.display,
    letterSpacing: font.size.display * -0.015,
    fontFamily: font.family.display,
    color: color.text,
  },
  significado: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  contraste: {
    alignSelf: 'stretch',
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.md,
  },
  contrasteTexto: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    textAlign: 'center',
  },
  confusa: { color: color.riskWarn, fontFamily: font.family.bodyStrong },
  resultado: { alignSelf: 'stretch', gap: space.sm },
  resultadoCard: { gap: 4 },
  resultadoTitulo: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
  },
  resultadoCuerpo: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  rendicion: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
  },
  pie: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    gap: space.sm,
  },
  privacidad: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
  },
});
