import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Card } from '@/components/base';
import { AudioButton } from '@/components/card';
import { OndaVoz, type VozEnVivo } from '@/components/fx';
import { color, desaparecer, font, motionDuration, motionEasing, reacomodar, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';

const ALTO_ONDA = 32;
const GROSOR_MARCA = 2;

/** Las reducciones que van sonando al revisar: la posición del audio y el segundo en que suena cada una. */
export interface Caceria {
  pos: SharedValue<number>;
  tiempos: number[];
}

/** Un marcador vertical en el centro de la onda, el «ahora» de la señal, cada vez que suena una reducción. */
function MarcaCaza({ caceria }: { caceria: Caceria }) {
  const reducido = useMovimientoReducido();
  const destello = useSharedValue(0);
  const { pos, tiempos } = caceria;

  useAnimatedReaction(
    () => (reducido ? 0 : tiempos.reduce((n, t) => n + (pos.value >= t ? 1 : 0), 0)),
    (cuenta, antes) => {
      if (antes !== null && cuenta > antes) {
        destello.value = withSequence(
          withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
          withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
        );
      }
    },
    [pos, tiempos, reducido]
  );

  const estilo = useAnimatedStyle(() => ({ opacity: destello.value, transform: [{ scaleY: 0.6 + 0.4 * destello.value }] }));
  if (reducido) return null;
  return <Animated.View pointerEvents="none" style={[styles.marca, estilo]} />;
}

interface Props {
  audio: string;
  audioLento: string;
  voz: VozEnVivo;
  vozLenta: VozEnVivo;
  /** La energía de la voz natural y la de la lenta (`analizar().envolvente`). */
  envolvente: number[];
  envolventeLenta: number[];
  /** Teléfono de poco alto: la onda va al lado de los botones y la tarjeta se aprieta. */
  compacta: boolean;
  /** La instrucción se va al revisar: ya no hace falta y el resultado necesita ese lugar. */
  conInstruccion: boolean;
  /** Solo al revisar: la onda marca el instante en que suena cada reducción correcta. */
  caceria: Caceria | null;
}

/**
 * La tarjeta de audio de Cázala: la instrucción, Escuchar y Lento del mismo tamaño y la onda de la frase, que
 * sube con la voz que suena (la natural o la lenta) y se aplana al terminar. El audio lo reproducen los botones;
 * aquí solo se ve.
 */
export function BloqueEscucha({
  audio,
  audioLento,
  voz,
  vozLenta,
  envolvente,
  envolventeLenta,
  compacta,
  conInstruccion,
  caceria,
}: Props) {
  const lenta = vozLenta.sonando;
  const onda = (
    <View
      style={compacta ? styles.ondaLado : styles.onda}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <OndaVoz voz={lenta ? vozLenta : voz} envolvente={lenta ? envolventeLenta : envolvente} alto={ALTO_ONDA} />
      {caceria ? <MarcaCaza caceria={caceria} /> : null}
    </View>
  );

  return (
    <Animated.View layout={reacomodar()}>
      <Card compacta>
        {conInstruccion ? (
          <Animated.Text exiting={desaparecer(motionDuration.rapido)} style={styles.instruccion}>
            Escucha y marca las tres reducciones que oíste
          </Animated.Text>
        ) : null}
        <View style={styles.fila}>
          <AudioButton path={audio} size="md" label="Escuchar" />
          <AudioButton path={audioLento} size="md" slow label="Lento" />
          {compacta ? onda : null}
        </View>
        {compacta ? null : onda}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  instruccion: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.4,
    color: color.textMuted,
    textAlign: 'center',
  },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  onda: { height: ALTO_ONDA, alignSelf: 'stretch' },
  ondaLado: { flex: 1, minWidth: 48, height: ALTO_ONDA },
  marca: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: -GROSOR_MARCA / 2,
    width: GROSOR_MARCA,
    borderRadius: GROSOR_MARCA / 2,
    backgroundColor: color.accent50,
  },
});
