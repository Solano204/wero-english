import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/shared/ui';
import { Marcador } from '@/shared/ui/fx/Marcador';
import { color, font, space } from '@/theme';

interface Props {
  resuelta: boolean;
  ultima: boolean;
  avanzando: boolean;
  pistas: number;
  puedePista: boolean;
  nota: string;
  onSiguiente: () => void;
  onPista: () => void;
  onRendirse: () => void;
}

/**
 * Zona 3 de Colmena, fija abajo: «Siguiente» (o «Terminar») con la ronda resuelta; si no, «Pista» y
 * «No me sale». Siempre con la nota de qué pasa si se acaba el tiempo.
 */
export function PieColmena({ resuelta, ultima, avanzando, pistas, puedePista, nota, onSiguiente, onPista, onRendirse }: Props) {
  return (
    <View style={styles.pie}>
      {resuelta ? (
        <Button
          label={ultima ? 'Terminar' : 'Siguiente'}
          icon={ultima ? 'check' : 'arrow-right'}
          iconAlFinal={!ultima}
          onPress={onSiguiente}
          disabled={avanzando}
          full
          size="lg"
        />
      ) : (
        <View style={styles.pieRow}>
          <Button
            icon="hint"
            label="Pista"
            accessibilityLabel={`Pista ${pistas}`}
            sufijo={<Marcador valor={pistas} tamano={font.size.md} color={color.text} />}
            variant="secondary"
            onPress={onPista}
            disabled={!puedePista}
            style={styles.grow}
          />
          <Button
            icon="reveal"
            label="No me sale"
            variant="ghost"
            onPress={onRendirse}
            style={styles.grow}
          />
        </View>
      )}
      <Text style={styles.nota}>{nota}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // El footer de Screen ya pone el padding horizontal y el de abajo
  // (con SafeArea incluida): aquí solo el espacio entre la fila de
  // botones y la nota.
  pie: { gap: space.sm },
  // Alto fijo de «Siguiente»: el pie no cambia de tamaño al resolverse la ronda, y el panal no se corre mientras vuela la última ficha.
  pieRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center', minHeight: 58 },
  grow: { flex: 1 },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
  },
});
