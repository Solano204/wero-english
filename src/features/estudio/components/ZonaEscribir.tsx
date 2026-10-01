import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button } from '@/shared/ui';
import type { useEfectoResultado } from '@/shared/hooks/useEfectoResultado';
import { color, font, radius, space } from '@/theme';

interface Props {
  typed: string;
  setTyped: (texto: string) => void;
  locked: boolean;
  acierto: boolean;
  /** Dictado pide lo que se oyó; Escribir, la frase. */
  dictado: boolean;
  usedHint: boolean;
  /** El efecto de acierto o fallo del bloque (useEfectoResultado). */
  estiloBloque: ReturnType<typeof useEfectoResultado>['estilo'];
  onPista: () => void;
  onRevisar: () => void;
}

/** La zona de escribir de Dictado y Escribir: el campo, «Pista» y «Revisar». */
export function ZonaEscribir({ typed, setTyped, locked, acierto, dictado, usedHint, estiloBloque, onPista, onRevisar }: Props) {
  return (
    <Animated.View style={[styles.zona, styles.typeArea, estiloBloque]}>
      <TextInput
        style={[
          styles.input,
          locked && (acierto ? styles.inputOk : styles.inputMiss),
        ]}
        value={typed}
        onChangeText={setTyped}
        editable={!locked}
        placeholder={
          dictado ? 'Escribe lo que oíste' : 'Escríbelo aquí'
        }
        placeholderTextColor={color.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={color.accent}
        onSubmitEditing={onRevisar}
        returnKeyType="done"
        accessibilityLabel="Tu respuesta en inglés"
      />
      {!locked ? (
        <View style={styles.typeActions}>
          <Button
            label={usedHint ? 'Pista usada' : 'Pista'}
            variant="ghost"
            onPress={onPista}
            disabled={usedHint}
          />
          <Button
            label="Revisar"
            onPress={onRevisar}
            disabled={typed.trim().length === 0}
            style={styles.grow}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zona: { flexGrow: 0, flexShrink: 1, minHeight: 120 },
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
