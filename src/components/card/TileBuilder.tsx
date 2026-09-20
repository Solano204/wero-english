import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, depth, font, layout, radius, shadow, space, reacomodar } from '@/theme';
import * as haptics from '@/services/haptics';
import { Presionable } from '@/components/base';

/** Reflow de las fichas armadas al agregar/quitar una. Respeta
 *  useMovimientoReducido por su cuenta: los presets de layout de
 *  Reanimated ya usan ReduceMotion.System por defecto. */
const fichaLayout = reacomodar();

interface Props {
  /** Todas las fichas: las de la frase más los señuelos, ya barajadas. */
  tiles: string[];
  locked: boolean;
  /** Lo que el usuario armó cuando ya se calificó, para pintar el fallo. */
  onSubmit: (armado: string) => void;
}

/**
 * El ejercicio Construir: se arma la frase tocando fichas de palabras.
 *
 * Las fichas usadas no desaparecen, se atenúan y se quedan en su lugar.
 * Si se quitaran, la fila de abajo se reacomodaría en cada toque y el
 * usuario perdería de vista dónde estaba la palabra que quería. Es un
 * detalle chico que decide si el ejercicio se siente firme o resbaloso.
 *
 * Los señuelos se quedan hasta el final: sobrarle fichas al usuario es
 * parte del ejercicio, y quitarlas al acertar le confirmaría la
 * respuesta antes de tiempo.
 */
export function TileBuilder({ tiles, locked, onSubmit }: Props) {
  // Se guardan índices, no textos: una frase puede repetir palabra
  // ("the ... the") y con textos se apagarían las dos de un toque.
  const [usados, setUsados] = useState<number[]>([]);

  const armado = useMemo(
    () => usados.map((i) => tiles[i] ?? '').join(' '),
    [usados, tiles]
  );

  const tomar = useCallback(
    (i: number) => {
      if (locked || usados.includes(i)) return;
      haptics.tapLight();
      setUsados((prev) => [...prev, i]);
    },
    [locked, usados]
  );

  const quitar = useCallback(
    (pos: number) => {
      if (locked) return;
      haptics.tapLight();
      setUsados((prev) => prev.filter((_, idx) => idx !== pos));
    },
    [locked]
  );

  return (
    <View style={styles.wrap}>
      <View style={[styles.linea, usados.length === 0 && styles.lineaVacia]}>
        {usados.length === 0 ? (
          <Text style={styles.placeholder}>Toca las palabras en orden</Text>
        ) : (
          usados.map((i, pos) => (
            <Presionable
              key={`puesta-${pos}-${i}`}
              layout={fichaLayout}
              onPress={() => quitar(pos)}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${tiles[i] ?? ''}`}
              accessibilityHint="La quita de la frase que estás armando"
              style={[styles.ficha, styles.fichaPuesta]}
            >
              <Text style={styles.fichaTextoPuesta}>{tiles[i]}</Text>
            </Presionable>
          ))
        )}
      </View>

      <View style={styles.banco}>
        {tiles.map((t, i) => {
          const gastada = usados.includes(i);
          return (
            <Presionable
              key={`banco-${i}-${t}`}
              onPress={() => tomar(i)}
              disabled={locked || gastada}
              accessibilityRole="button"
              accessibilityLabel={t}
              accessibilityHint="La añade a la frase que estás armando"
              accessibilityState={{ disabled: gastada }}
              style={[styles.ficha, gastada && styles.fichaGastada]}
            >
              <Text style={[styles.fichaTexto, gastada && styles.textoGastado]}>
                {t}
              </Text>
            </Presionable>
          );
        })}
      </View>

      {!locked ? (
        <View style={styles.acciones}>
          <Presionable
            onPress={() => setUsados([])}
            disabled={usados.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Borrar lo armado"
            hitSlop={8}
          >
            <Text
              style={[
                styles.borrar,
                usados.length === 0 && styles.borrarApagado,
              ]}
            >
              Empezar de nuevo
            </Text>
          </Presionable>

          <Presionable
            onPress={() => onSubmit(armado)}
            disabled={usados.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Revisar la frase"
            style={[styles.revisar, usados.length === 0 && styles.revisarApagado]}
          >
            <Text style={styles.revisarTexto}>Revisar</Text>
          </Presionable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  linea: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    minHeight: 56,
    borderBottomWidth: 1.5,
    borderBottomColor: color.border,
    paddingBottom: space.sm,
    alignItems: 'center',
  },
  lineaVacia: { justifyContent: 'center' },
  placeholder: { color: color.textFaint, fontFamily: font.family.body, fontSize: font.size.sm },
  banco: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  ficha: {
    minHeight: layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderBottomWidth: depth.md,
    borderBottomColor: color.borderStrong,
    backgroundColor: color.surface,
    ...shadow.soft,
  },
  fichaPuesta: {
    backgroundColor: color.accentSoft,
    borderColor: color.accent,
  },
  fichaGastada: {
    backgroundColor: color.surface,
    borderColor: color.surface,
  },
  fichaTexto: { color: color.text, fontFamily: font.family.body, fontSize: font.size.md },
  fichaTextoPuesta: {
    color: color.accent,
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
  },
  textoGastado: { color: 'transparent' },
  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  borrar: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.sm },
  borrarApagado: { color: color.textFaint, opacity: 0.5 },
  revisar: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    borderBottomWidth: depth.sm,
    borderBottomColor: color.accentDeep,
  },
  revisarApagado: { opacity: 0.45 },
  revisarTexto: {
    color: color.onAccent,
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
  },
});
