import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/base/Icon';
import { AudioButton } from '@/components/card';
import { FraseKaraoke, type VozEnVivo } from '@/components/fx';
import type { Palabra } from '@/domain/marcas';
import {
  color,
  desaparecer,
  filoOk,
  filoWrong,
  font,
  motionDuration,
  motionEasing,
  motionSpring,
  radius,
  sol,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { FraseMorph, type ItemMorph } from './FraseMorph';

interface Props {
  /** Cuántas de las tres reducciones marcó bien (0 a 3). */
  aciertos: number;
  fraseReal: string;
  fraseFormal: string;
  fraseEs: string;
  audioEs: string;
  /** La frase que suena, palabra por palabra con sus tiempos, y las que son reducciones. */
  palabras: Palabra[];
  destacadas: ReadonlySet<number>;
  voz: VozEnVivo;
  /** Las reducciones con su forma completa, y la posición del audio (o de su reloj sin voz) que las dispara. */
  morphs: ItemMorph[];
  pos: SharedValue<number>;
  /** Cuánto mide la hoja: la lista deja ese espacio libre al final para poder llegar a todas sus filas. */
  alAlto: (alto: number) => void;
}

/**
 * El resultado de una ronda de Cázala: una hoja compacta que sube sobre la parte baja de la lista, sin velo y sin
 * tapar la tarjeta de audio, cuando el veredicto ya se vio en sus renglones. «Las tres» o «N de 3», la frase con
 * las reducciones resaltadas y su karaoke, la forma completa de cada una (que se transforma al sonar), la frase
 * formal y la traducción con su audio. «Siguiente» vive en el pie fijo. Con «reducir movimiento» aparece con un
 * fundido. El fallo es ámbar, nunca rojo.
 */
export function ResultadoCaza({
  aciertos,
  fraseReal,
  fraseFormal,
  fraseEs,
  audioEs,
  palabras,
  destacadas,
  voz,
  morphs,
  pos,
  alAlto,
}: Props) {
  const reducido = useMovimientoReducido();
  const { height: alturaVentana } = useWindowDimensions();
  const y = useSharedValue(reducido ? 0 : alturaVentana);
  const opacidad = useSharedValue(reducido ? 0 : 1);
  const ok = aciertos === 3;
  const veredicto = ok ? 'Las tres' : `${aciertos} de 3`;

  useEffect(() => {
    // Espera a que el veredicto se vea en los renglones antes de subir.
    const espera = motionDuration.lento;
    if (reducido) opacidad.value = withDelay(espera, withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
    else y.value = withDelay(espera, withSpring(0, motionSpring.rebote));
  }, [reducido, y, opacidad]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${veredicto}. ${fraseReal}. Forma completa: ${fraseFormal}`);
    // Solo cuenta el momento en que aparece la hoja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estilo = useAnimatedStyle(() => ({ opacity: opacidad.value, transform: [{ translateY: y.value }] }));

  return (
    <Animated.View exiting={desaparecer(motionDuration.rapido)} style={styles.raiz} pointerEvents="box-none">
      <Animated.View style={estilo}>
        <LinearGradient colors={ok ? filoOk : filoWrong} start={sol.start} end={sol.end} style={styles.filo}>
          <View
            style={[styles.contenido, ok ? styles.ok : styles.mal]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${veredicto}. ${fraseReal}. Forma completa: ${fraseFormal}. ${fraseEs}`}
            onLayout={(e) => alAlto(e.nativeEvent.layout.height)}
          >
            <View style={styles.titulo}>
              {ok ? <Icon name="check" size="md" color={color.correct} /> : null}
              <Text style={[styles.veredicto, ok ? styles.textoOk : styles.textoMal]}>{veredicto}</Text>
            </View>

            <FraseKaraoke palabras={palabras} voz={voz} tamano="h3" destacadas={destacadas} />
            <FraseMorph reducciones={morphs} pos={pos} />
            <Text style={styles.formal}>{fraseFormal}</Text>

            <View style={styles.traduccion}>
              <Text style={styles.es}>{fraseEs}</Text>
              <AudioButton path={audioEs} size="sm" />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  raiz: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // El filo de luz de 1 px, solo arriba: la hoja se apoya en el pie fijo.
  filo: {
    padding: 1,
    paddingBottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  contenido: {
    padding: space.lg,
    gap: space.sm,
    alignItems: 'center',
    borderTopLeftRadius: radius.xl - 1,
    borderTopRightRadius: radius.xl - 1,
    overflow: 'hidden',
  },
  ok: { backgroundColor: color.correctFondo },
  mal: { backgroundColor: color.wrongFondo },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  veredicto: {
    fontSize: font.size.sm,
    fontFamily: font.family.bodyStrong,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  textoOk: { color: color.correct },
  textoMal: { color: color.wrong },
  formal: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.4,
    color: color.textMuted,
    textAlign: 'center',
  },
  traduccion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  es: {
    flexShrink: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.4,
    color: color.textMuted,
    textAlign: 'center',
  },
});
