import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
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
import { logHabla } from '@/data/repos/partidas';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/data/contenido';
import { useConsentimiento } from '@/components/legal';
import { MedidorMicrofono } from '@/components/voz/MedidorMicrofono';
import { useEscucha } from '@/hooks/useEscucha';
import * as speech from '@/services/voz';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, radius, space, aparecer } from '@/theme';
import type { HablaVeredicto, ParMinimoRound } from '@/types';
import type { RootStackParams } from '@/navigation/routes';
import { useEfectoResultado } from '@/components/feedback';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'MinimalPairs'>;

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
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const micHabilitado = useSettingsStore((s) => s.micHabilitado);
  const setSetting = useSettingsStore((s) => s.set);

  const content = useMemo(loadContent, []);
  const estado = useMemo(() => speech.isAvailable(), []);
  useCortarAudioAlSalir();

  // Si llega `fonemaId` (desde el laboratorio de sonidos), las rondas salen de los pares de ese fonema; si no
  // tiene pares, o no se abrió desde ahí, salen de todos como siempre.
  const [rounds] = useState<ParMinimoRound[]>(() => {
    const propios = params?.fonemaId
      ? buildRounds(content.fonemas.fonemas.filter((f) => f.id === params.fonemaId))
      : [];
    return propios.length > 0 ? propios : buildRounds(content.fonemas.fonemas);
  });
  const [idx, setIdx] = useState(0);
  const { fase, ocupado, sinVoz, nivel, escuchar: escucharVoz } = useEscucha();
  // Dónde se reconoce la voz en este teléfono: lo dice la línea de privacidad de abajo.
  const [enDispositivo, setEnDispositivo] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void speech.reconoceEnDispositivo().then((v) => {
      if (vivo) setEnDispositivo(v);
    });
    return () => {
      vivo = false;
    };
  }, []);
  const [veredicto, setVeredicto] = useState<HablaVeredicto | null>(null);
  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();
  const efecto = useEfectoResultado();
  const { disparar } = efecto;

  useEffect(() => {
    if (!veredicto) return;
    disparar(veredicto.tipo === 'acierto' ? 'acierto' : veredicto.tipo === 'confusa' ? 'fallo' : null);
  }, [veredicto, disparar]);
  const [aciertos, setAciertos] = useState(0);
  const [fallidos, setFallidos] = useState(0);

  const round = rounds[idx];

  const escuchar = useCallback(async () => {
    if (!round || ocupado) return;

    // Antes de tocar el micrófono, la hoja que dice adónde va la voz. «Ahora no» sigue sin micro.
    if (!(await pedirConsentimiento('microfono'))) {
      setVeredicto({
        tipo: 'no_disponible',
        razon: 'Sin el micrófono no hay forma de escuchar. Toca «Escuchar» cuando quieras activarlo.',
      });
      return;
    }

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

    setVeredicto(null);

    const oido = await escucharVoz([round.objetivo, round.confusa]);
    // Ya había una escucha en curso (doble toque): esta no cuenta.
    if (!oido) return;

    const v = juzgar(round, oido.alternativas, content.confusionesVoz.pares);
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
      // No se cuenta como fallo: se pide repetir.
      setFallidos((f) => f + 1);
    }

    // Todo intento queda con sus alternativas (para ver después qué palabras fallan más). Los «no te entendí» no
    // cuentan en los resúmenes (ver HABLA_CUENTA en db/economy.ts).
    if (user && v.tipo !== 'no_disponible') {
      await logHabla(user.id, round.id, round.objetivo, v.tipo, v.oido, v.alternativas);
    }
  }, [round, ocupado, micHabilitado, user, setSetting, pedirConsentimiento, escucharVoz, content]);

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
  const noEntendi = veredicto?.tipo === 'no_entendi';
  const oyo = veredicto && veredicto.tipo !== 'no_disponible' ? veredicto.oido : null;
  const etiquetaBoton =
    fase === 'preparando'
      ? 'Preparando…'
      : fase === 'escuchando'
        ? 'Te escucho'
        : fase === 'procesando'
          ? 'Procesando…'
          : noEntendi
            ? 'Repetir'
            : 'Toca para hablar';

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
                    { color: acerto ? color.correct : noEntendi ? color.text : color.wrong },
                  ]}
                >
                  {exp.titulo}
                </Text>
                <Text style={styles.resultadoCuerpo}>{exp.cuerpo}</Text>
                {/* Lo que escribió el reconocedor: así se aprende de la diferencia. */}
                {oyo ? <Text style={styles.oyo}>{`Oí: «${oyo}»`}</Text> : null}
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
        <View style={styles.medidor}>
          <MedidorMicrofono nivel={nivel} activo={fase === 'escuchando'} />
          {/* Siempre ocupa su renglón: aparecer o irse no mueve el botón. */}
          <Text style={styles.sinVoz} accessibilityLiveRegion="polite">
            {sinVoz ? 'No te escucho. Acércate al teléfono o habla un poco más fuerte.' : ' '}
          </Text>
        </View>
        <Button
          label={etiquetaBoton}
          onPress={() => void escuchar()}
          loading={fase === 'preparando' || fase === 'procesando'}
          disabled={ocupado}
          variant={noEntendi || !veredicto ? 'primary' : 'secondary'}
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
          {enDispositivo
            ? 'Tu voz se reconoce en este teléfono. No se graba nada.'
            : 'El servicio de voz del teléfono puede procesar tu voz en sus servidores. Wero no graba nada.'}
        </Text>
      </View>
      {hoja}
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
  oyo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  medidor: { alignItems: 'center', gap: space.xs },
  sinVoz: {
    minHeight: font.size.sm * 1.5 * 2,
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.5,
    color: color.textMuted,
    textAlign: 'center',
  },
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
