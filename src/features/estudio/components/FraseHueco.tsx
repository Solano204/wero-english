import React, { useEffect, type RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { color, font, motionSpring, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** Lo que dejó el usuario en el hueco al calificar. */
export interface RellenoHueco {
  palabra: string;
  estado: 'ok' | 'mal';
}

interface Props {
  /** La frase con el hueco marcado como `______` (lo que arma `blankOut`). */
  texto: string;
  relleno: RellenoHueco | null;
  /** Para medir dónde está el hueco y hacer volar la palabra hasta él. */
  huecoRef: RefObject<View | null>;
  /** Ancho mínimo del hueco: el de la palabra más larga, para que la frase no se reacomode al llenarse. */
  anchoHueco: number;
}

const MARCA_HUECO = '______';

function Relleno({ palabra, estado }: RellenoHueco) {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(reducido ? 1 : 0.85);
  useEffect(() => {
    escala.set(reducido ? 1 : withSpring(1, motionSpring.rebote));
  }, [reducido, escala]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  return (
    <Animated.Text style={[styles.palabra, estado === 'ok' ? styles.ok : styles.mal, anim]}>{palabra}</Animated.Text>
  );
}

/**
 * La frase de Completar con su hueco. El hueco es una vista que se puede medir:
 * ahí aterriza la palabra que el usuario tocó. Al calificar queda la palabra en
 * verde, o en ámbar y tachada (no solo color) si no era esa.
 */
export function FraseHueco({ texto, relleno, huecoRef, anchoHueco }: Props) {
  const fichas = texto.split(/\s+/).filter(Boolean);
  const frase = texto.replace(MARCA_HUECO, relleno ? relleno.palabra : 'hueco');
  return (
    <View style={styles.fila} accessible accessibilityRole="text" accessibilityLabel={frase}>
      {fichas.map((ficha, i) => {
        if (!ficha.includes(MARCA_HUECO)) {
          return (
            <Text key={`${i}-${ficha}`} style={styles.palabra}>
              {ficha}
            </Text>
          );
        }
        const [antes = '', despues = ''] = ficha.split(MARCA_HUECO);
        return (
          <View key={`${i}-hueco`} style={styles.conHueco}>
            {antes ? <Text style={styles.palabra}>{antes}</Text> : null}
            <View
              ref={huecoRef}
              collapsable={false}
              style={[styles.hueco, { minWidth: anchoHueco }, relleno && (relleno.estado === 'ok' ? styles.huecoOk : styles.huecoMal)]}
            >
              {relleno ? <Relleno {...relleno} /> : null}
            </View>
            {despues ? <Text style={styles.palabra}>{despues}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    columnGap: space.sm,
  },
  conHueco: { flexDirection: 'row', alignItems: 'baseline' },
  palabra: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    lineHeight: font.size.xxl * 1.25,
    color: color.text,
  },
  ok: { color: color.correct },
  mal: { color: color.wrong, textDecorationLine: 'line-through' },
  hueco: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: color.borderStrong,
    marginHorizontal: space.xs,
  },
  huecoOk: { borderBottomColor: color.correct },
  huecoMal: { borderBottomColor: color.wrong },
});
