import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { PASOS_REGISTRO, PASO_EXPLICITO, pasoRegistro, textoRegistro } from '@/domain/registro';
import { color, font, motionSpring, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

const PASOS = PASOS_REGISTRO.length;
const HUECO = space.xs;
const INDICADOR = 16;
const ALTO_SEGMENTO = 4;
/** Cuánto antes y después de su paso empieza a encenderse un segmento al pasar el indicador. */
const ALCANCE = 0.6;

interface SegmentoProps {
  indice: number;
  pos: SharedValue<number>;
  tinte: string;
}

/** Un segmento de la escala: gris, y se enciende cuando el indicador pasa por él. */
function Segmento({ indice, pos, tinte }: SegmentoProps) {
  const luz = useAnimatedStyle(() => ({
    opacity: interpolate(pos.get(), [indice - ALCANCE, indice, indice + ALCANCE], [0, 1, 0], Extrapolation.CLAMP),
  }));
  return (
    <View style={styles.segmento}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tinte }, luz]} />
    </View>
  );
}

interface Props {
  registro: string;
  vulgaridad: number;
  /** Espera (ms) antes de que el indicador salga: la coreografía de entrada de la pantalla. */
  retraso?: number;
}

/**
 * El registro de la frase como escala de 5 pasos, de «Formal» a «Solo con amigos».
 * Un indicador sale del primer paso y se desliza hasta el actual con el resorte
 * `rebote`, encendiendo los segmentos a su paso; el actual queda encendido. El último
 * paso (lenguaje explícito) va en `riskStrong`, el único rojo, con su ícono y su texto:
 * nunca solo color. Con reducir movimiento aparece ya en su paso. El lector de pantalla
 * dice «Registro: muy informal, 4 de 5».
 */
export function EscalaRegistro({ registro, vulgaridad, retraso = 0 }: Props) {
  const reducido = useMovimientoReducido();
  const actual = pasoRegistro(registro, vulgaridad);
  const explicito = actual === PASO_EXPLICITO;
  const tinte = explicito ? color.riskStrong : color.accent;
  const pos = useSharedValue(reducido ? actual : 0);
  const ancho = useSharedValue(0);

  useEffect(() => {
    pos.set(reducido ? actual : withDelay(retraso, withSpring(actual, motionSpring.rebote)));
  }, [actual, reducido, retraso, pos]);

  const indicador = useAnimatedStyle(() => {
    const paso = (ancho.get() + HUECO) / PASOS;
    return { transform: [{ translateX: (pos.get() + 0.5) * paso - HUECO / 2 - INDICADOR / 2 }] };
  });

  const alMedir = (e: LayoutChangeEvent) => {
    ancho.set(e.nativeEvent.layout.width);
  };

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="text"
      accessibilityLabel={textoRegistro(actual)}
    >
      <View style={styles.cabeza}>
        <Text style={styles.caption}>Registro</Text>
        <View style={styles.actual}>
          {explicito ? <Icon name="warning" size="sm" color={color.riskStrong} /> : null}
          <Text style={[styles.etiqueta, explicito && styles.etiquetaExplicita]}>{PASOS_REGISTRO[actual]}</Text>
        </View>
      </View>

      <View style={styles.pista} onLayout={alMedir}>
        <View style={styles.segmentos}>
          {PASOS_REGISTRO.map((nombre, i) => (
            <Segmento key={nombre} indice={i} pos={pos} tinte={i === PASO_EXPLICITO ? color.riskStrong : color.accent} />
          ))}
        </View>
        <Animated.View style={[styles.indicador, { backgroundColor: tinte }, indicador]} />
      </View>

      <View style={styles.extremos}>
        <Text style={styles.extremo}>{PASOS_REGISTRO[0]}</Text>
        <Text style={styles.extremo}>{PASOS_REGISTRO[PASO_EXPLICITO]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 160, gap: space.sm },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  caption: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: font.family.bodyStrong,
  },
  actual: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  etiquetaExplicita: { color: color.riskStrong },
  pista: { height: INDICADOR, justifyContent: 'center' },
  segmentos: { flexDirection: 'row', gap: HUECO },
  segmento: {
    flex: 1,
    height: ALTO_SEGMENTO,
    borderRadius: radius.pill,
    backgroundColor: color.trackFondo,
    overflow: 'hidden',
  },
  indicador: {
    position: 'absolute',
    left: 0,
    width: INDICADOR,
    height: INDICADOR,
    borderRadius: INDICADOR / 2,
    borderWidth: 2,
    borderColor: color.bg,
  },
  extremos: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  extremo: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
});
