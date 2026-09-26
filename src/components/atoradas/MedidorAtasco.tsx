import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { PUNTOS_ATASCO, etiquetaFallos, puntosEncendidos, type TamanoAtorada } from '@/domain/atoradas';
import { color, font, space } from '@/theme';

/** Lado de cada punto, en dp: los de una tarjeta grande son un poco más grandes. */
const LADO = { normal: 10, grande: 14 } as const;
const PUNTOS = Array.from({ length: PUNTOS_ATASCO }, (_, i) => i);

interface PuntoProps {
  indice: number;
  encendido: boolean;
  lado: number;
  /** Cuántos puntos van apagados, con decimales (de 0 a `PUNTOS_ATASCO`): el que va en curso se apaga a medias. */
  apagado: SharedValue<number>;
}

function PuntoApagable({ indice, encendido, lado, apagado }: PuntoProps) {
  const estilo = useAnimatedStyle(() => ({
    opacity: encendido ? 1 - Math.min(1, Math.max(0, apagado.value - indice)) : 0,
  }));
  return (
    <View style={[styles.punto, { width: lado, height: lado, borderRadius: lado / 2 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.encendido, estilo]} />
    </View>
  );
}

interface Props {
  fallos: number;
  tamano?: TamanoAtorada;
  /** Para que los puntos se apaguen uno por uno (cuando una frase se desatora). Sin él, los puntos son fijos. */
  apagado?: SharedValue<number>;
}

/**
 * El medidor de atasco: cinco puntos, tantos encendidos en `wrong` (ámbar) como fallos haya, con el tope en cinco, y
 * debajo el número real («4 fallos», o «7 fallos» aunque solo haya cinco puntos). Nada se comunica solo con los puntos:
 * el lector de pantalla oye «4 fallos». Con `apagado` los puntos se apagan uno por uno; sin él no se anima nada.
 */
export function MedidorAtasco({ fallos, tamano = 'normal', apagado }: Props) {
  const lit = puntosEncendidos(fallos);
  const lado = LADO[tamano];
  return (
    <View style={styles.medidor} accessible accessibilityLabel={etiquetaFallos(fallos)}>
      <View style={styles.puntos} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {PUNTOS.map((i) =>
          apagado ? (
            <PuntoApagable key={i} indice={i} encendido={i < lit} lado={lado} apagado={apagado} />
          ) : (
            <View
              key={i}
              style={[styles.punto, i < lit && styles.encendido, { width: lado, height: lado, borderRadius: lado / 2 }]}
            />
          )
        )}
      </View>
      <Text style={styles.etiqueta} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {etiquetaFallos(fallos)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  medidor: { alignItems: 'flex-end', gap: space.xs },
  puntos: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  punto: { backgroundColor: color.borderStrong, overflow: 'hidden' },
  encendido: { backgroundColor: color.wrong },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.textMuted },
});
