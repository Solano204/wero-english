import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Badge, Card, Icon } from '@/components/base';
import { anuncioDeError, anuncioGravedad } from '@/domain/errores';
import { aparecerSubiendo, color, escalon, font, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import type { ErrorCard } from '@/types';
import { MedidorGravedad } from './MedidorGravedad';

/** Ancho de la columna de los íconos: el de `md`, para que los tres renglones queden alineados. */
const ANCHO_ICONO = 20;

interface Props {
  error: ErrorCard;
  /** Posición en la lista, para la entrada escalonada. */
  indice: number;
  /** Solo las primeras de una lista entran animadas; el resto aparece directo. */
  animar: boolean;
  onAbrir: (errorId: string) => void;
}

/**
 * Un error de la lista: lo que dices tachado con una ✕ en `wrong`, lo que entienden en ámbar cursiva con el ícono de
 * señal rota, lo correcto con una ✓ en `correct`, y a la derecha el medidor de gravedad con su etiqueta. Si se puede
 * contar, «Para contar» en `accentSoft`. La entrada va en un `Animated.View` aparte porque `Card` anima su propia escala
 * al presionar. Para el lector de pantalla es un solo botón que dice el malentendido completo y su gravedad.
 */
export const TarjetaError = memo(function TarjetaError({ error: e, indice, animar, onAbrir }: Props) {
  const reducido = useMovimientoReducido();
  const abrir = useCallback(() => onAbrir(e.id), [onAbrir, e.id]);
  const descripcion = `${anuncioDeError(e)} ${anuncioGravedad(e.gravedad)}.${e.compartible ? ' Para contar.' : ''}`;

  return (
    <Animated.View entering={animar && !reducido ? aparecerSubiendo(escalon(indice)) : undefined}>
      <Card onPress={abrir} accessibilityLabel={descripcion}>
        <View style={styles.fila}>
          <View style={styles.textos}>
            <View style={styles.renglon}>
              <View style={styles.icono}>
                <Icon name="close" size="md" color={color.wrong} />
              </View>
              <Text style={styles.dice} numberOfLines={2}>
                {e.lo_que_dices}
              </Text>
            </View>
            <View style={styles.renglon}>
              <View style={styles.icono}>
                <Icon name="signal-broken" size="sm" color={color.wrong} />
              </View>
              <Text style={styles.entienden} numberOfLines={2}>
                {e.lo_que_entienden}
              </Text>
            </View>
            <View style={styles.renglon}>
              <View style={styles.icono}>
                <Icon name="check" size="md" color={color.correct} />
              </View>
              <Text style={styles.correcto} numberOfLines={2}>
                {e.lo_correcto}
              </Text>
            </View>
            {e.compartible ? <Badge label="Para contar" tone="accent" small /> : null}
          </View>
          <MedidorGravedad gravedad={e.gravedad} />
        </View>
      </Card>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  textos: { flex: 1, gap: space.xs },
  renglon: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  icono: { width: ANCHO_ICONO, alignItems: 'center', paddingTop: space.xs },
  dice: {
    flex: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.text,
    textDecorationLine: 'line-through',
  },
  entienden: {
    flex: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.wrong,
    fontStyle: 'italic',
  },
  correcto: {
    flex: 1,
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.text,
  },
});
