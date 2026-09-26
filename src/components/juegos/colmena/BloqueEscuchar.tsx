import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button } from '@/components/base/Button';
import { OndaVoz, type VozEnVivo } from '@/components/fx';
import { motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { plural } from '@/utils/text';

const ANCHO_ONDA = 88;
const ALTO_ONDA = 32;
/** La onda se apaga sin escuchas. */
const OPACIDAD_APAGADA = 0.35;

interface Props {
  /** Las escuchas que quedan en la ronda. */
  escuchas: number;
  /** Suena la frase ahora mismo: el botón espera y la onda se enciende. */
  sonando: boolean;
  voz: VozEnVivo;
  /** La energía de la voz (`analizar().envolvente`). */
  envolvente: number[];
  onEscuchar: () => void;
  /** Al resolverse la ronda se desvanece, pero sigue ocupando su lugar: nada de lo que está debajo se mueve. */
  visible: boolean;
}

/**
 * «Escuchar · quedan 2» con la onda de la voz al lado. La onda sube mientras suena la frase y se aplana al
 * terminar; sin escuchas el botón dice «Sin escuchas» y la onda se apaga. La cuenta de escuchas y el audio los
 * lleva la pantalla: aquí solo se ve.
 */
export function BloqueEscuchar({ escuchas, sonando, voz, envolvente, onEscuchar, visible }: Props) {
  const reducido = useMovimientoReducido();
  const presente = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    presente.value = withTiming(visible ? 1 : 0, {
      duration: reducido ? motionDuration.rapido : motionDuration.base,
      easing: motionEasing.salir,
    });
  }, [visible, reducido, presente]);
  const estilo = useAnimatedStyle(() => ({ opacity: presente.value }));
  const sinEscuchas = escuchas <= 0;
  const etiqueta = sinEscuchas ? 'Sin escuchas' : `Escuchar · ${plural(escuchas, 'queda', 'quedan')} ${escuchas}`;
  return (
    <Animated.View
      style={[styles.fila, estilo]}
      pointerEvents={visible ? 'auto' : 'none'}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!visible}
    >
      <Button icon="volume" label={etiqueta} variant="secondary" onPress={onEscuchar} disabled={sinEscuchas || sonando} />
      <View
        style={[styles.onda, sinEscuchas && styles.apagada]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <OndaVoz voz={voz} envolvente={envolvente} alto={ALTO_ONDA} tono={sinEscuchas ? 'neutro' : 'senal'} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  onda: { width: ANCHO_ONDA, height: ALTO_ONDA },
  apagada: { opacity: OPACIDAD_APAGADA },
});
