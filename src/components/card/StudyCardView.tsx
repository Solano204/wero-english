import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { AudioButton } from './AudioButton';
import { OptionButton, type OptionState } from './OptionButton';
import { PhraseBlock } from './PhraseBlock';
import { SceneImage } from './SceneImage';
import { TileBuilder } from './TileBuilder';
import { Button, RiskBadge } from '@/components/base';
import { answerMode, instructionFor, promptFor } from '@/domain/exercise';
import { isCloseEnough } from '@/utils/text';
import { color, font, motionDuration, radius, space, aparecerSubiendo, desaparecer } from '@/theme';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import type { StudyCard } from '@/types';

/**
 * Entrada de la tarjeta: cae con un resorte suave, sin sobrepaso (no es
 * un rebote juguetón, es una tarjeta nueva llegando). La salida de la
 * anterior es un fundido corto para no competir con la que entra.
 * Ambos presets ya respetan la accesibilidad de movimiento reducido del
 * sistema por su cuenta (ReduceMotion.System).
 */
const cardEntering = aparecerSubiendo();
const cardExiting = desaparecer(motionDuration.rapido);

interface Props {
  card: StudyCard;
  locked: boolean;
  chosen: string | null;
  autoAudio: boolean;
  onAnswer: (correct: boolean, elapsedMs: number, usedHint: boolean) => void;
  onChoose: (value: string) => void;
}

/**
 * La tarjeta de estudio. Renderiza los seis tipos de ejercicio.
 *
 * El cronómetro empieza cuando la tarjeta aparece y se lee al responder:
 * de ahí sale la calificación 4 contra 3 en SM-2. Se guarda en un ref
 * porque un state provocaría un render por segundo sin necesidad.
 */
export function StudyCardView({
  card,
  locked,
  chosen,
  autoAudio,
  onAnswer,
  onChoose,
}: Props) {
  const startedAt = useRef(Date.now());
  const [typed, setTyped] = useState('');
  // Bloquea el paso mientras suena el audio. En Escuchar y Dictado el
  // audio ES el ejercicio: dejar avanzar a media reproducción es dejar
  // responder sin haber oído la pregunta.
  const [sonando, setSonando] = useState(false);
  const [usedHint, setUsedHint] = useState(false);

  const prompt = useMemo(() => promptFor(card), [card]);
  const modo = answerMode(card.kind);
  const isTyping = modo === 'type';

  // Id estable de la tarjeta. `card` es un objeto nuevo en cada
  // respuesta (el store lo reconstruye), así que depender de él directo
  // repetiría el audio al mostrar el feedback sin que la tarjeta haya
  // cambiado de verdad.
  const cardId = `${card.entry.id}:${card.kind}`;

  useEffect(() => {
    startedAt.current = Date.now();
    setTyped('');
    setUsedHint(false);

    // En Escuchar y en Dictado el audio suena solo: el ejercicio es el
    // audio, y obligar a un toque extra antes de empezar solo estorba.
    const debeSonar =
      card.kind === 'escuchar' ||
      card.kind === 'dictado' ||
      (autoAudio && Boolean(card.entry.audio_en) && card.kind === 'reconocer');

    if (!debeSonar) return;

    // Retraso corto y cancelable: si la tarjeta cambia antes de que se
    // cumpla (otro salto rápido), el cleanup lo cancela y nunca llega a
    // sonar. Sin esto, cada salto disparaba su propio audio.play() sin
    // esperar a ver si el usuario ya iba de salida a la siguiente.
    const t = setTimeout(() => {
      void audio.play(card.entry.audio_en);
    }, 150);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, autoAudio]);

  // Escuchar y Dictado son ejercicios de oído puro: hasta la música de
  // fondo suave estorba. Cada tarjeta es un montaje nuevo (StudyScreen le
  // da key por card.kind), así que esto alcanza sin más lógica: se
  // pausa al entrar a una de oído y se retoma sola al salir.
  useMusicaPantalla(
    card.kind === 'escuchar' || card.kind === 'dictado' ? 'silencio' : 'app'
  );

  const handleChoice = (value: string) => {
    if (locked) return;
    onChoose(value);
    onAnswer(value === card.answer, Date.now() - startedAt.current, usedHint);
  };

  const handleSubmit = () => {
    if (locked || typed.trim().length === 0) return;
    onChoose(typed);
    onAnswer(
      isCloseEnough(typed, card.answer),
      Date.now() - startedAt.current,
      usedHint
    );
  };

  /**
   * Construir se califica con la misma tolerancia que Escribir. No hay
   * razón para ser más estricto aquí: el usuario ya demostró que sabe
   * el orden de las palabras, y marcarle mal un apóstrofo de una ficha
   * que la app misma le dio sería un error de la app, no suyo.
   */
  const handleTiles = (armado: string) => {
    if (locked) return;
    onChoose(armado);
    onAnswer(
      isCloseEnough(armado, card.answer),
      Date.now() - startedAt.current,
      usedHint
    );
  };

  const stateFor = (option: string): OptionState => {
    if (!locked) return chosen === option ? 'chosen' : 'idle';
    if (option === card.answer) return 'correct';
    if (option === chosen) return 'wrong';
    return 'dimmed';
  };

  return (
    /*
     * La tarjeta va dentro de un scroll.
     *
     * Antes era una vista fija de flex:1, y cuando la frase ocupaba dos
     * renglones más la imagen, el IPA y los dos botones de audio, la
     * cuarta opción quedaba pegada al borde de abajo o directamente
     * fuera de pantalla. En un teléfono chico eso significaba responder
     * sin haber visto todas las opciones.
     *
     * `flexGrow: 1` mantiene el centrado cuando la tarjeta es corta y
     * deja crecer cuando es larga: no hay que elegir entre las dos.
     */
    <Animated.ScrollView
      entering={cardEntering}
      exiting={cardExiting}
      style={styles.wrap}
      contentContainerStyle={styles.contenido}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <Text style={styles.instruction}>{instructionFor(card.kind)}</Text>
        <RiskBadge vulgaridad={card.entry.vulgaridad} />
      </View>

      <View style={styles.stage}>
        {card.kind === 'escuchar' || card.kind === 'dictado' ? (
          <View style={styles.listen}>
            <AudioButton path={card.entry.audio_en} size="lg" label="Otra vez" />
            <AudioButton
              path={card.entry.audio_en}
              size="md"
              slow
              label="Más lento"
            />
            {card.kind === 'dictado' ? (
              <Text style={styles.hintLine}>
                No hay texto. Dale las veces que quieras.
              </Text>
            ) : null}
          </View>
        ) : card.kind === 'construir' ? (
          <View style={styles.reveal}>
            <Text style={styles.spanishPrompt}>{prompt}</Text>
            <AudioButton path={card.entry.audio_en} size="md" label="Escuchar" />
          </View>
        ) : card.kind === 'completar' ? (
          <PhraseBlock
            entry={card.entry}
            override={prompt}
            showAudio={false}
            showIpa={false}
          />
        ) : card.kind === 'escribir' ? (
          <Text style={styles.spanishPrompt}>{prompt}</Text>
        ) : (
          <View style={styles.reveal}>
            {card.entry.imagen ? (
              <SceneImage path={card.entry.imagen} size={150} ancha etiqueta={card.entry.phrase} />
            ) : null}
            <PhraseBlock entry={card.entry} />
          </View>
        )}
      </View>

      {modo === 'tiles' ? (
        <TileBuilder
          key={`tiles-${card.entry.id}-${card.state.repeticiones}`}
          tiles={card.options}
          locked={locked}
          onSubmit={handleTiles}
        />
      ) : isTyping ? (
        <View style={styles.typeArea}>
          <TextInput
            style={[
              styles.input,
              locked && (chosen === card.answer ? styles.inputOk : styles.inputMiss),
            ]}
            value={typed}
            onChangeText={setTyped}
            editable={!locked}
            placeholder={
              card.kind === 'dictado' ? 'Escribe lo que oíste' : 'Escríbelo aquí'
            }
            placeholderTextColor={color.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={color.accent}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            accessibilityLabel="Tu respuesta en inglés"
          />
          {!locked ? (
            <View style={styles.typeActions}>
              <Button
                label={usedHint ? 'Pista usada' : 'Pista'}
                variant="ghost"
                onPress={() => {
                  setUsedHint(true);
                  setTyped(firstWords(card.answer));
                }}
                disabled={usedHint}
              />
              <Button
                label="Revisar"
                onPress={handleSubmit}
                disabled={typed.trim().length === 0}
                style={styles.grow}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.options}>
          {card.options.map((opt, i) => (
            <OptionButton
              key={`${card.entry.id}-${opt}`}
              label={opt}
              index={i}
              state={stateFor(opt)}
              disabled={locked}
              onPress={() => handleChoice(opt)}
            />
          ))}
        </View>
      )}
    </Animated.ScrollView>
  );
}

/** Da las dos primeras palabras como pista, no la respuesta entera. */
function firstWords(answer: string): string {
  const parts = answer.split(' ');
  return parts.slice(0, Math.min(2, parts.length - 1)).join(' ');
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  contenido: { flexGrow: 1, gap: space.lg, paddingBottom: space.lg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 26,
  },
  instruction: {
    fontSize: font.size.xs,
    color: color.textFaint,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: font.family.bodyStrong,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 140,
  },
  listen: { alignItems: 'center', gap: space.md },
  hintLine: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
  },
  spanishPrompt: {
    fontSize: font.size.xl,
    color: color.text,
    textAlign: 'center',
    lineHeight: font.size.xl * 1.35,
    fontFamily: font.family.body,
  },
  reveal: { alignItems: 'center', gap: space.lg },
  options: { gap: space.md },
  typeArea: { gap: space.md },
  input: {
    minHeight: 58,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    color: color.text,
    fontFamily: font.family.body,
    fontSize: font.size.lg,
  },
  inputOk: { borderColor: color.correct },
  inputMiss: { borderColor: color.wrong },
  typeActions: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
});
