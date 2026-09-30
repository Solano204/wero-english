import React, { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useVisto } from '@/shared/hooks/useVisibilidad';
import { partirFormula, type Ficha, type Segmento } from '@/domain/gramatica';
import { color, escalon, font, motionDuration, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** Cuánto llega desde la izquierda cada pieza al entrar, en dp. */
const DESLIZA = 8;

interface EntraProps {
  /** Empieza cuando la fórmula entra a la vista. */
  activo: boolean;
  retraso: number;
  children: ReactNode;
}

/** Una pieza de la fórmula que entra con un fundido, deslizándose 8 dp desde la izquierda, tras su `retraso`. */
function Entra({ activo, retraso, children }: EntraProps) {
  const reducido = useMovimientoReducido();
  const avance = useSharedValue(reducido ? 1 : 0);

  useEffect(() => {
    if (!activo) return;
    if (reducido) {
      avance.set(1);
      return;
    }
    avance.set(withDelay(retraso, withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar })));
    return () => cancelAnimation(avance);
  }, [activo, reducido, retraso, avance]);

  const estilo = useAnimatedStyle(() => ({
    opacity: avance.get(),
    transform: [{ translateX: (avance.get() - 1) * DESLIZA }],
  }));
  return <Animated.View style={estilo}>{children}</Animated.View>;
}

function Segmentos({ segmentos, estilo }: { segmentos: Segmento[]; estilo: object }) {
  return (
    <Text style={estilo}>
      {segmentos.map((s, i) => (
        <Text key={i} style={s.fuerte ? styles.fuerte : undefined}>
          {s.texto}
        </Text>
      ))}
    </Text>
  );
}

/** Lo que oye el lector de pantalla de un renglón: sus partes, unidas con «más». */
function etiquetaRenglon(renglon: Ficha[]): string {
  return renglon.map((ficha) => ficha.map((s) => s.texto).join('')).join(', más ');
}

interface Props {
  formula: string;
  /** El scroll de la pantalla: las fichas entran cuando la fórmula llega a la vista. */
  scrollY: SharedValue<number>;
}

/**
 * «Cómo se arma» en bloques. Cada alternativa de la fórmula (separadas por «·» en los datos) es un renglón; cada
 * parte de un renglón (separadas por «+») es una ficha, con el «+» en `textFaint` entre una y otra. Lo que cambia
 * respecto a la otra regla viene marcado en los datos con `**` y se pinta en `accent`. Las fichas entran de izquierda
 * a derecha con el escalón de las listas, una sola vez, cuando la fórmula entra a la vista; con "reducir movimiento" ya
 * están en su lugar. Una fórmula sin «·» ni «+» se muestra como texto.
 */
export function FormulaFichas({ formula, scrollY }: Props) {
  const partida = useMemo(() => partirFormula(formula), [formula]);
  const { ref, alAcomodar, visto } = useVisto(scrollY);

  if (partida.tipo === 'texto') {
    return (
      <View style={styles.texto}>
        <Segmentos segmentos={partida.segmentos} estilo={styles.contenido} />
      </View>
    );
  }

  return (
    <Animated.View ref={ref} collapsable={false} onLayout={alAcomodar} style={styles.renglones}>
      {partida.renglones.map((renglon, r) => (
        <View key={r} accessible accessibilityLabel={etiquetaRenglon(renglon)} style={styles.renglon}>
          {renglon.map((ficha, j) => (
            <React.Fragment key={j}>
              {j > 0 ? (
                <Entra activo={visto} retraso={escalon(r) + escalon(2 * j - 1)}>
                  <Text style={styles.mas}>+</Text>
                </Entra>
              ) : null}
              <Entra activo={visto} retraso={escalon(r) + escalon(2 * j)}>
                <View style={styles.ficha}>
                  <Segmentos segmentos={ficha} estilo={styles.contenido} />
                </View>
              </Entra>
            </React.Fragment>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  renglones: { gap: space.md },
  renglon: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  ficha: {
    flexShrink: 1,
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  texto: {
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  contenido: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.text,
  },
  fuerte: { fontFamily: font.family.bodyStrong, color: color.accent },
  mas: { fontFamily: font.family.bodyStrong, fontSize: font.size.lg, color: color.textFaint },
});
