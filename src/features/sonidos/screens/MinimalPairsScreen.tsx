import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Card, EmptyState, Header, ProgressBar, Screen } from '@/shared/ui';
import { AudioButton } from '@/shared/ui/AudioButton';
import { explicar } from '@/domain/minimalPairs';
import { MedidorMicrofono } from '@/shared/ui/MedidorMicrofono';
import { color, font, radius, space, aparecer } from '@/theme';
import { useParesMinimos } from '@/features/sonidos/hooks/useParesMinimos';

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
  const { nav, estado, rounds, idx, fase, ocupado, sinVoz, nivel, enDispositivo, veredicto, hoja, efecto, fallidos, round, escuchar, siguiente } = useParesMinimos();

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
