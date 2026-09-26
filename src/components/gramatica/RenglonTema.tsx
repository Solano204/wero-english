import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Icon, Presionable } from '@/components/base';
import { color, escalon, font, layout, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { GramaticaTema } from '@/types';
import type { Avance } from './BloqueGramatica';
import { MedidorNivel } from './MedidorNivel';

/** Cuánto gira el candado al abrirse, en grados. */
const GIRO_CANDADO = 40;
/** Alto de la línea del candado: es la misma abierta o cerrada, para que el renglón no salte al desbloquearse. */
const ALTO_CANDADO = 16;

interface Props {
  tema: GramaticaTema;
  /** Cuántas barras tiene el medidor (el nivel más alto que trae algún tema). */
  niveles: number;
  cerrado: boolean;
  primero: boolean;
  /** Posición en el bloque y avance de su despliegue: entra con `escalon(indice)` desde 8 dp más abajo. */
  indice: number;
  avance: Avance;
  onPress: () => void;
}

/**
 * Renglón de un tema dentro de su bloque: título, el gancho en una o dos líneas y a la derecha el medidor de nivel.
 * Un tema cerrado lleva debajo del medidor el candado y «Anuncio» en `accent`, y su título va en `textMuted`. Cuando el
 * anuncio lo abre, el candado gira y se desvanece, «Anuncio» se apaga y el título toma su color: el renglón queda como
 * los demás. La animación espera a que termine la transición de volver a la lista, para que se vea.
 */
export function RenglonTema({ tema, niveles, cerrado, primero, indice, avance, onPress }: Props) {
  const reducido = useMovimientoReducido();
  const retraso = escalon(indice);
  // Un tema que nunca estuvo cerrado no reserva el hueco del candado.
  const tuvoCandado = useRef(cerrado).current;
  const abierta = useSharedValue(cerrado ? 0 : 1);

  useEffect(() => {
    if (cerrado) {
      abierta.value = 0;
      return;
    }
    if (reducido || !tuvoCandado) {
      abierta.value = 1;
      return;
    }
    abierta.value = withDelay(
      motionDuration.lento,
      withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar })
    );
    return () => cancelAnimation(abierta);
  }, [cerrado, reducido, tuvoCandado, abierta]);

  const entrada = useAnimatedStyle(() => {
    const progreso = avance.progreso.value;
    // Cerrando no hay escalón: todos salen juntos.
    const espera = avance.abriendo.value === 0 ? 0 : retraso;
    const t = interpolate(progreso * motionDuration.lento, [espera, motionDuration.lento], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: (1 - t) * space.sm }] };
  });
  const estiloTitulo = useAnimatedStyle(() => ({
    color: interpolateColor(abierta.value, [0, 1], [color.textMuted, color.text]),
  }));
  const estiloCandado = useAnimatedStyle(() => ({
    opacity: 1 - abierta.value,
    transform: [{ rotate: `${-abierta.value * GIRO_CANDADO}deg` }],
  }));
  const estiloAnuncio = useAnimatedStyle(() => ({ opacity: 1 - abierta.value }));

  const etiqueta = `${tema.titulo}. ${tema.gancho}. Nivel ${tema.nivel} de ${niveles}.${
    cerrado ? ' Se abre con un anuncio.' : ''
  }`;

  return (
    <Animated.View style={entrada}>
      <Presionable onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta} style={styles.fila}>
        {primero ? null : <View style={styles.separador} />}
        <View style={styles.texto}>
          <Animated.Text style={[styles.titulo, estiloTitulo]}>{tema.titulo}</Animated.Text>
          <Text style={styles.gancho} numberOfLines={2}>
            {tema.gancho}
          </Text>
        </View>
        <View style={styles.derecha}>
          <MedidorNivel nivel={tema.nivel} total={niveles} />
          {tuvoCandado ? (
            <View style={styles.candadoFila}>
              <Animated.View style={estiloCandado}>
                <Icon name="lock" size="sm" color={color.accent} />
              </Animated.View>
              <Animated.Text style={[styles.anuncio, estiloAnuncio]}>Anuncio</Animated.Text>
            </View>
          ) : null}
        </View>
      </Presionable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fila: {
    minHeight: layout.filaModo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  separador: { position: 'absolute', top: 0, left: space.lg, right: 0, height: 1, backgroundColor: color.border },
  texto: { flex: 1, gap: space.xs },
  titulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md },
  gancho: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.45,
    color: color.textMuted,
  },
  derecha: { alignItems: 'flex-end', gap: space.xs },
  candadoFila: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: ALTO_CANDADO },
  anuncio: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.accent },
});
