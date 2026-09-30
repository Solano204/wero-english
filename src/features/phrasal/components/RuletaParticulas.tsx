import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { ALTO_ITEM, VISIBLES, destinoSuelta, destinoToque, limitarIndice, poseItem, posElastica } from '@/domain/ruleta';
import * as haptics from '@/services/haptics';
import { color, motionSpring, text } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** Tres partículas a la vista: la elegida y una arriba y una abajo (las que siguen se apagan al salir). */
export const ALTO_RUEDA = ALTO_ITEM * 3;
const PERSPECTIVA = 500;
/** Partículas de más que se dibujan a cada lado, para que no aparezcan de golpe al girar rápido. */
const MARGEN_RENDER = 1;

// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const ELEGIDA = color.accent;
const VECINA = color.textFaint;

interface ItemProps {
  indice: number;
  etiqueta: string;
  pos: SharedValue<number>;
  /** Sin perspectiva ni giro (reducir movimiento). */
  plano: boolean;
}

/** Una partícula de la rueda: su lugar, tamaño, giro, opacidad y color salen de qué tan lejos está del centro. */
function ItemRuleta({ indice, etiqueta, pos, plano }: ItemProps) {
  const estilo = useAnimatedStyle(() => {
    const d = indice - pos.value;
    const p = poseItem(d);
    return {
      opacity: p.opacidad,
      color: interpolateColor(Math.min(1, Math.abs(d)), [0, 1], [ELEGIDA, VECINA]),
      transform: plano
        ? [{ translateY: p.y }, { scale: p.escala }]
        : [{ perspective: PERSPECTIVA }, { translateY: p.y }, { rotateX: `${p.giro}deg` }, { scale: p.escala }],
    };
  });
  return <Animated.Text style={[styles.particula, estilo]}>{etiqueta}</Animated.Text>;
}

interface Props {
  verbo: string;
  /** El nombre de cada partícula del verbo, en orden (las repetidas ya van numeradas). */
  etiquetas: readonly string[];
  /** La forma elegida. Si cambia desde fuera (los chips, deslizar la tarjeta), la rueda gira hasta ella. */
  indice: number;
  /** Lo que anuncia el lector de pantalla: «get up, levantarse de la cama, 1 de 14». */
  anuncio: string;
  /** El usuario dejó la rueda asentada en otra partícula. */
  onElegir: (indice: number) => void;
}

/**
 * La ruleta de partículas: una rueda vertical, tipo selector de iOS. La elegida va al centro en `accent` y a tamaño
 * completo; las vecinas, más chicas, giradas hacia atrás y en `textFaint`. Se gira con un deslizamiento vertical y se
 * asienta con un resorte en la que queda al centro (la velocidad del dedo cuenta); tocar una vecina la trae al centro.
 * Cada vez que se asienta en otra suena un háptico de selección y `onElegir` avisa.
 *
 * Todo lo que se mueve corre en el hilo de UI: la posición es un valor compartido, el gesto y el resorte son worklets
 * y cada partícula lee ese valor. Solo se renderizan las partículas cercanas al centro (el estado `centro` cambia
 * cuando la rueda pasa de una a la siguiente, no por cuadro). Es un control ajustable para el lector de pantalla:
 * «aumentar» y «disminuir» cambian de partícula. Con «reducir movimiento» no hay perspectiva ni giro y el resorte es
 * directo.
 */
export function RuletaParticulas({ verbo, etiquetas, indice, anuncio, onElegir }: Props) {
  const reducido = useMovimientoReducido();
  const n = etiquetas.length;
  const pos = useSharedValue(indice);
  const inicio = useSharedValue(0);
  const arrastrando = useSharedValue(0);
  const [centro, setCentro] = useState(indice);
  const confirmado = useRef(indice);
  const alElegir = useRef(onElegir);
  alElegir.current = onElegir;

  useAnimatedReaction(
    () => limitarIndice(pos.value, n),
    (ahora, antes) => {
      if (ahora !== antes) runOnJS(setCentro)(ahora);
    },
    [n]
  );

  /** La rueda terminó de asentarse en `destino`: si es otra partícula, se avisa y se siente. */
  const asentar = useCallback((destino: number) => {
    if (destino === confirmado.current) return;
    confirmado.current = destino;
    haptics.selection();
    alElegir.current(destino);
  }, []);

  // Si la forma cambia desde fuera, la rueda gira hasta ella (salvo que el dedo la tenga tomada).
  useEffect(() => {
    confirmado.current = indice;
    if (arrastrando.value === 1 || Math.abs(pos.value - indice) < 0.01) return;
    pos.value = reducido ? indice : withSpring(indice, motionSpring.ruleta);
  }, [indice, reducido, pos, arrastrando]);

  const gesto = useMemo(() => {
    const irA = (destino: number) => {
      'worklet';
      if (reducido) {
        pos.value = destino;
        runOnJS(asentar)(destino);
        return;
      }
      pos.value = withSpring(destino, motionSpring.ruleta, (fin) => {
        if (fin) runOnJS(asentar)(destino);
      });
    };
    const arrastre = Gesture.Pan()
      .activeOffsetY([-8, 8])
      .failOffsetX([-24, 24])
      .onStart(() => {
        cancelAnimation(pos);
        inicio.value = pos.value;
        arrastrando.value = 1;
      })
      .onUpdate((e) => {
        pos.value = posElastica(inicio.value - e.translationY / ALTO_ITEM, n);
      })
      .onEnd((e, exito) => {
        irA(destinoSuelta(pos.value, exito ? e.velocityY : 0, n));
      })
      .onFinalize(() => {
        arrastrando.value = 0;
      });
    const toque = Gesture.Tap()
      .maxDistance(10)
      .onEnd((e, exito) => {
        if (!exito) return;
        const destino = destinoToque(e.y, ALTO_RUEDA, pos.value, n);
        if (destino !== limitarIndice(pos.value, n)) irA(destino);
      });
    return Gesture.Race(arrastre, toque);
  }, [n, reducido, pos, inicio, arrastrando, asentar]);

  const alAccion = (e: AccessibilityActionEvent) => {
    const paso = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
    const destino = limitarIndice(indice + paso, n);
    if (paso === 0 || destino === indice) return;
    confirmado.current = destino;
    haptics.selection();
    onElegir(destino);
  };

  const desde = Math.max(0, centro - VISIBLES - MARGEN_RENDER);
  const hasta = Math.min(n - 1, centro + VISIBLES + MARGEN_RENDER);
  const items: React.ReactNode[] = [];
  for (let i = desde; i <= hasta; i++) {
    items.push(<ItemRuleta key={i} indice={i} etiqueta={etiquetas[i] ?? ''} pos={pos} plano={reducido} />);
  }

  return (
    <GestureDetector gesture={gesto}>
      <View
        style={styles.rueda}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Partícula de ${verbo}`}
        accessibilityValue={{ text: anuncio }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={alAccion}
      >
        {items}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  rueda: { flex: 1, height: ALTO_RUEDA, overflow: 'hidden' },
  // Cada partícula ocupa el centro de la rueda y se desplaza desde ahí; la escala y el giro parten de su borde izquierdo,
  // para que las vecinas queden alineadas con la elegida.
  particula: {
    ...text.display,
    position: 'absolute',
    left: 0,
    right: 0,
    top: (ALTO_RUEDA - ALTO_ITEM) / 2,
    height: ALTO_ITEM,
    lineHeight: ALTO_ITEM,
    transformOrigin: 'left center',
  },
});
