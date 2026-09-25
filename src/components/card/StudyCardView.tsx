import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { BloqueVoz } from './BloqueVoz';
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
import { useEfectoResultado } from '@/components/feedback';

/**
 * Entrada de la tarjeta: cae con un resorte suave, sin sobrepaso (no es
 * un rebote juguetón, es una tarjeta nueva llegando). La salida de la
 * anterior es un fundido corto para no competir con la que entra.
 * Ambos presets ya respetan la accesibilidad de movimiento reducido del
 * sistema por su cuenta (ReduceMotion.System).
 */
const cardEntering = aparecerSubiendo();
const cardExiting = desaparecer(motionDuration.rapido);

/**
 * Por debajo de esta altura de ventana (un teléfono de 640 dp) todo se aprieta:
 * huecos de 8, opciones de 52 y la imagen a 72. Por encima se queda holgado.
 */
const ALTURA_COMPACTA = 700;
const IMAGEN_COMPACTA = 72;
const IMAGEN_HOLGADA = 150;

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
  const compacto = useWindowDimensions().height < ALTURA_COMPACTA;
  const [typed, setTyped] = useState('');
  // Bloquea el paso mientras suena el audio. En Escuchar y Dictado el
  // audio ES el ejercicio: dejar avanzar a media reproducción es dejar
  // responder sin haber oído la pregunta.
  const [sonando, setSonando] = useState(false);
  const [usedHint, setUsedHint] = useState(false);

  const prompt = useMemo(() => promptFor(card), [card]);
  const modo = answerMode(card.kind);
  const isTyping = modo === 'type';

  // Con opciones cada `OptionButton` hace su efecto; al armar o escribir la
  // respuesta, la pieza es todo el bloque.
  const { estilo: estiloBloque, disparar } = useEfectoResultado();
  useEffect(() => {
    if (!locked || modo === 'choice') return;
    disparar(chosen === card.answer ? 'acierto' : 'fallo');
    // Solo al bloquearse la tarjeta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

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
     * Estructura fija, pensada para el pulgar: la instrucción y la frase
     * arriba (tercio superior) y lo que se toca abajo (mitad inferior).
     *
     * Nada scrollea si cabe. Antes toda la tarjeta era un scroll, y la
     * cuarta opción quedaba fuera de pantalla en un teléfono chico. Ahora
     * el bloque de la frase no encoge y solo la zona de abajo se acorta y
     * scrollea si de verdad no cabe (con la acción principal fija fuera
     * del scroll), así que las opciones siempre están donde el dedo llega.
     */
    <Animated.View entering={cardEntering} exiting={cardExiting} style={[styles.wrap, compacto && styles.wrapCompacto]}>
      <View style={styles.top}>
        <Text style={styles.instruction}>{instructionFor(card.kind)}</Text>
        <RiskBadge vulgaridad={card.entry.vulgaridad} />
      </View>

      <View style={[styles.stage, compacto && styles.stageCompacto]}>
        {card.kind === 'escuchar' || card.kind === 'dictado' ? (
          <BloqueVoz entry={card.entry} variante="oido" dictado={card.kind === 'dictado'} compacto={compacto} />
        ) : card.kind === 'construir' ? (
          <BloqueVoz entry={card.entry} variante="pista" pista={prompt} compacto={compacto} />
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
          <View style={[styles.reveal, compacto && styles.revealCompacto]}>
            {card.entry.imagen ? (
              <SceneImage
                path={card.entry.imagen}
                size={compacto ? IMAGEN_COMPACTA : IMAGEN_HOLGADA}
                ancha
                etiqueta={card.entry.phrase}
              />
            ) : null}
            <BloqueVoz entry={card.entry} variante="frase" compacto={compacto} />
          </View>
        )}
      </View>

      {modo === 'tiles' ? (
        <Animated.View style={[styles.zona, estiloBloque]}>
          <TileBuilder
            key={`tiles-${card.entry.id}-${card.state.repeticiones}`}
            tiles={card.options}
            locked={locked}
            compacto={compacto}
            onSubmit={handleTiles}
          />
        </Animated.View>
      ) : isTyping ? (
        <Animated.View style={[styles.zona, styles.typeArea, estiloBloque]}>
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
        </Animated.View>
      ) : (
        <ScrollView
          style={styles.zona}
          contentContainerStyle={[styles.options, compacto && styles.optionsCompacto]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          overScrollMode="never"
        >
          {card.options.map((opt, i) => (
            <OptionButton
              key={`${card.entry.id}-${opt}`}
              label={opt}
              index={i}
              state={stateFor(opt)}
              disabled={locked}
              compacta={compacto}
              onPress={() => handleChoice(opt)}
            />
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

/** Da las dos primeras palabras como pista, no la respuesta entera. */
function firstWords(answer: string): string {
  const parts = answer.split(' ');
  return parts.slice(0, Math.min(2, parts.length - 1)).join(' ');
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: space.md },
  wrapCompacto: { gap: space.sm },
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
  // La frase se ancla arriba y no encoge: si algo tiene que ceder, es la zona de abajo.
  stage: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: space.lg,
  },
  stageCompacto: { paddingTop: space.xs },
  // Lo que se toca: no crece, y si no cabe es lo único que se acorta (y scrollea).
  zona: { flexGrow: 0, flexShrink: 1, minHeight: 120 },
  spanishPrompt: {
    fontSize: font.size.xl,
    color: color.text,
    textAlign: 'center',
    lineHeight: font.size.xl * 1.35,
    fontFamily: font.family.body,
  },
  reveal: { alignItems: 'center', gap: space.md },
  revealCompacto: { gap: space.sm },
  options: { gap: space.md },
  optionsCompacto: { gap: space.sm },
  typeArea: { gap: space.md, flexShrink: 0 },
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
