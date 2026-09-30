import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { OptionButton, type OptionState } from '@/components/card';
import { PuntosRepeticion } from '@/components/fx';
import { aparecer, color, font, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import type { LecturaPregunta } from '@/types';

/** Cuántas preguntas tiene toda historia: son los tres puntos de arriba. */
export const TOTAL_PREGUNTAS = 3;

interface Props {
  pregunta: LecturaPregunta;
  /** De 0 a 2. */
  indice: number;
  /** La opción que eligió, o undefined mientras no responde. */
  respuesta: number | undefined;
  onResponder: (opcion: number) => void;
}

function estadoDe(k: number, correcta: number, respuesta: number | undefined): OptionState {
  if (respuesta === undefined) return 'idle';
  if (k === correcta) return 'correct';
  return k === respuesta ? 'wrong' : 'dimmed';
}

/**
 * Una pregunta a la vez, con tres puntos de avance arriba (los mismos de Estudio). Al responder, la opción elegida y la
 * correcta se marcan como en Estudio (acierto en verde con palomita, fallo en ámbar con equis y la correcta encendida) y
 * la explicación entra con fade. No hay puntaje: la nota de arriba lo dice cada vez. Con «reducir movimiento» la
 * explicación aparece sin fade.
 */
export function PreguntaUnaAUna({ pregunta, indice, respuesta, onResponder }: Props) {
  const reducido = useMovimientoReducido();
  const contestada = respuesta !== undefined;

  return (
    <View style={styles.raiz}>
      <PuntosRepeticion
        ronda={(indice + 1) as 1 | 2 | 3}
        etiqueta={`Pregunta ${indice + 1} de ${TOTAL_PREGUNTAS}`}
      />
      <Text style={styles.nota}>No se guarda calificación. Es para ver si se entendió, no para calificarte.</Text>

      <Animated.Text
        key={indice}
        entering={reducido ? undefined : aparecer()}
        accessibilityRole="header"
        style={styles.pregunta}
      >
        {pregunta.pregunta}
      </Animated.Text>

      <View style={styles.opciones}>
        {pregunta.opciones.map((o, k) => (
          <OptionButton
            key={`${indice}-${k}`}
            index={k}
            label={o}
            state={estadoDe(k, pregunta.correcta, respuesta)}
            disabled={contestada}
            onPress={() => onResponder(k)}
          />
        ))}
      </View>

      {contestada ? (
        <Animated.Text
          key={`porque-${indice}`}
          entering={reducido ? undefined : aparecer()}
          accessibilityLiveRegion="polite"
          style={styles.porque}
        >
          {pregunta.porque}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: space.lg },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
  pregunta: {
    fontFamily: font.family.display,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.25,
    color: color.text,
  },
  opciones: { gap: space.sm },
  porque: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
});
