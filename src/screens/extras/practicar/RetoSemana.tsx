import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { Badge, Card, Icon } from '@/components/base';
import { Marcador, MedidorVU } from '@/components/fx';
import { useVisibilidad } from '@/components/fx/useVisibilidad';
import { aparecerZoom, color, font, motionSenal, space } from '@/theme';
import { conteo, plural, useMovimientoReducido } from '@/utils';
import { celebrarSiToca } from './celebracion';
import { diasQueQuedan, textoDiasReto } from './reto';

interface Props {
  llevas: number;
  meta: number;
  cumplido: boolean;
  /** Lunes de la semana en curso, YYYY-MM-DD. */
  desde: string;
  /** Hoy, YYYY-MM-DD. */
  hoy: string;
  usuarioId: number | null;
  scrollY: SharedValue<number>;
}

/**
 * El reto de la semana como medidor VU: un segmento por acierto de la meta que se
 * enciende al entrar a la vista, el contador que rueda como marcador y los días
 * que quedan. Al completarlo, un destello del medidor y una estrella, una vez por
 * semana y sin confeti. Nada se mueve en bucle.
 */
export function RetoSemana({ llevas, meta, cumplido, desde, hoy, usuarioId, scrollY }: Props) {
  const reducido = useMovimientoReducido();
  const { ref, visible, alAcomodar } = useVisibilidad(scrollY);
  const [visto, setVisto] = useState(false);
  const [celebrar, setCelebrar] = useState(false);

  useAnimatedReaction(
    () => visible.value,
    (ahora, antes) => {
      if (ahora === 1 && antes !== 1) runOnJS(setVisto)(true);
    }
  );

  useEffect(() => {
    if (!visto || !cumplido || usuarioId === null) return;
    let vivo = true;
    void celebrarSiToca(usuarioId, 'reto', desde).then((toca) => {
      if (vivo && toca) setCelebrar(true);
    });
    return () => {
      vivo = false;
    };
  }, [visto, cumplido, usuarioId, desde]);

  return (
    <Animated.View ref={ref} collapsable={false} onLayout={alAcomodar}>
      <Card>
        <View style={styles.fila}>
          <View style={styles.texto}>
            <Text style={styles.titulo}>Reto de la semana</Text>
            <View style={styles.contador} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Marcador valor={visto ? llevas : 0} tamano={font.size.xl} color={color.accent} />
              <Text style={styles.de}>de {meta}</Text>
            </View>
          </View>
          {cumplido ? null : <Badge label={textoDiasReto(diasQueQuedan(desde, hoy))} tone="accent" small />}
        </View>
        <MedidorVU
          valor={llevas}
          total={meta}
          activo={visto}
          celebrar={celebrar}
          etiqueta={`${llevas} de ${meta} ${plural(meta, 'acierto')} esta semana`}
        />
        {cumplido ? (
          visto ? (
            <Animated.View entering={reducido ? undefined : aparecerZoom(motionSenal.medidor)} style={styles.completo}>
              <Icon name="star-filled" size="lg" color={color.star} />
              <Text style={styles.cuerpo}>{`Reto completo. ${conteo(meta, 'acierto')} esta semana.`}</Text>
            </Animated.View>
          ) : null
        ) : (
          <Text style={styles.cuerpo}>Cuenta lo que aciertas estudiando y jugando. No hay reloj y no se pierde.</Text>
        )}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  texto: { flex: 1, gap: space.xs },
  titulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  contador: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  de: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  completo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cuerpo: {
    flex: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
});
