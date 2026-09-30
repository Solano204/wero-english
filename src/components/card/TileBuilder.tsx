import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  color,
  depth,
  entrarRebote,
  font,
  layout,
  motionDuration,
  motionEasing,
  motionVeredicto,
  radius,
  shadow,
  space,
  reacomodar,
} from '@/theme';
import * as haptics from '@/services/haptics';
import { Presionable } from '@/components/base';
import { normalizeAnswer } from '@/domain/texto';
import { useMovimientoReducido } from '@/utils/accessibility';

/** Reflow de las fichas armadas al agregar/quitar una. Respeta
 *  useMovimientoReducido por su cuenta: los presets de layout de
 *  Reanimated ya usan ReduceMotion.System por defecto. */
const fichaLayout = reacomodar();
/** Una ficha que entra a la frase salta a su lugar con el resorte de `rebote`. */
const fichaEntra = entrarRebote();

// Copias locales: un worklet captura estos textos, no el objeto de tema entero.
const ACENTO = color.accent;
const ACENTO_SUAVE = color.accentSoft;
const OK = color.correct;
const FONDO_OK = color.correctFondo;
const MAL = color.wrong;
const FONDO_MAL = color.wrongFondo;

interface Props {
  /** Todas las fichas: las de la frase más los señuelos, ya barajadas. */
  tiles: string[];
  locked: boolean;
  /** Lo que el usuario armó cuando ya se calificó, para pintar el fallo. */
  onSubmit: (armado: string) => void;
  /** La frase correcta: al calificar, cada ficha puesta se compara con la palabra que le tocaba. */
  respuesta: string;
  /** Teléfono chico: huecos de 8 en el banco. */
  compacto?: boolean;
}

type VeredictoFicha = 'ok' | 'mal';

interface FichaPuestaProps {
  texto: string;
  pos: number;
  veredicto: VeredictoFicha | null;
  onQuitar: () => void;
}

/**
 * Una ficha ya puesta en la frase. Al calificar se ilumina palabra por palabra, de
 * izquierda a derecha: en verde si era la palabra que tocaba en ese lugar, en ámbar
 * (y subrayada, para no depender del color) si no.
 */
function FichaPuesta({ texto, pos, veredicto, onQuitar }: FichaPuestaProps) {
  const reducido = useMovimientoReducido();
  const luz = useSharedValue(0);

  useEffect(() => {
    if (!veredicto) {
      luz.value = 0;
      return;
    }
    const retraso = Math.min(pos, motionVeredicto.maxPalabras) * motionVeredicto.palabra;
    luz.value = reducido
      ? 1
      : withDelay(retraso, withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
  }, [veredicto, pos, reducido, luz]);

  const fondo = veredicto === 'mal' ? FONDO_MAL : FONDO_OK;
  const borde = veredicto === 'mal' ? MAL : OK;
  const estilo = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(luz.value, [0, 1], [ACENTO_SUAVE, fondo]),
    borderColor: interpolateColor(luz.value, [0, 1], [ACENTO, borde]),
  }));
  const tinta = useAnimatedStyle(() => ({ color: interpolateColor(luz.value, [0, 1], [ACENTO, borde]) }));

  return (
    // El reacomodo y la entrada van en un `Animated.View` aparte: `Presionable` anima su propio transform (la escala)
    // y una animación de layout en ese mismo nodo lo pisaría.
    <Animated.View layout={fichaLayout} entering={fichaEntra}>
    <Presionable
      onPress={onQuitar}
      disabled={veredicto !== null}
      accessibilityRole="button"
      accessibilityLabel={
        veredicto === null ? `Quitar ${texto}` : `${texto}. ${veredicto === 'ok' ? 'Correcta' : 'No era esta'}`
      }
      accessibilityHint={veredicto === null ? 'La quita de la frase que estás armando' : undefined}
    >
      <Animated.View style={[styles.ficha, styles.fichaPuesta, estilo]}>
        <Animated.Text style={[styles.fichaTextoPuesta, veredicto === 'mal' && styles.subrayada, tinta]}>
          {texto}
        </Animated.Text>
      </Animated.View>
    </Presionable>
    </Animated.View>
  );
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
export function TileBuilder({ tiles, locked, onSubmit, respuesta, compacto = false }: Props) {
  // Se guardan índices, no textos: una frase puede repetir palabra
  // ("the ... the") y con textos se apagarían las dos de un toque.
  const [usados, setUsados] = useState<number[]>([]);

  const armado = useMemo(
    () => usados.map((i) => tiles[i] ?? '').join(' '),
    [usados, tiles]
  );

  // Al calificar, cada ficha puesta contra la palabra que le tocaba en ese lugar.
  const veredictos = useMemo<VeredictoFicha[]>(() => {
    const esperadas = respuesta.split(/\s+/).filter(Boolean).map(normalizeAnswer);
    return usados.map((i, pos) => (normalizeAnswer(tiles[i] ?? '') === esperadas[pos] ? 'ok' : 'mal'));
  }, [respuesta, usados, tiles]);

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
      <ScrollView
        style={styles.cuerpo}
        contentContainerStyle={[styles.cuerpoContenido, compacto && styles.cuerpoCompacto]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
      >
      <View style={[styles.linea, usados.length === 0 && styles.lineaVacia]}>
        {usados.length === 0 ? (
          <Text style={styles.placeholder}>Toca las palabras en orden</Text>
        ) : (
          // La llave es la ficha, no su lugar: al quitar una del medio las demás no se
          // remontan y solo salta la que entra.
          usados.map((i, pos) => (
            <FichaPuesta
              key={`puesta-${i}`}
              texto={tiles[i] ?? ''}
              pos={pos}
              veredicto={locked ? (veredictos[pos] ?? null) : null}
              onQuitar={() => quitar(pos)}
            />
          ))
        )}
      </View>

      <View style={[styles.banco, compacto && styles.bancoCompacto]}>
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
      </ScrollView>

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
      ) : (
        <View style={styles.accionesReserva} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1, gap: space.md },
  // Las fichas scrollean solas si no caben; "Revisar" y "Empezar de nuevo" quedan fijos abajo.
  cuerpo: { flexGrow: 0, flexShrink: 1 },
  cuerpoContenido: { gap: space.md },
  cuerpoCompacto: { gap: space.sm },
  bancoCompacto: { gap: space.sm },
  // Al calificar las acciones se van, pero su hueco se queda: el banco no salta.
  accionesReserva: { minHeight: 48 },
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
  subrayada: { textDecorationLine: 'underline' },
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
