import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card } from '@/components/base';
import { AnilloMeta } from '@/components/fx';
import { anillo, color, font, space } from '@/theme';
import { diasQueQuedan, textoDiasReto } from './reto';

interface Props {
  llevas: number;
  meta: number;
  cumplido: boolean;
  /** Lunes de la semana en curso, YYYY-MM-DD. */
  desde: string;
  /** Hoy, YYYY-MM-DD. */
  hoy: string;
}

/** El reto de la semana como tarjeta: anillo de progreso y los días que quedan. */
export function RetoSemana({ llevas, meta, cumplido, desde, hoy }: Props) {
  return (
    <Card>
      <View style={styles.fila}>
        <View style={styles.texto}>
          <Text style={styles.titulo}>Reto de la semana</Text>
          <Text style={styles.numero}>
            {llevas} de {meta}
          </Text>
        </View>
        <AnilloMeta
          valor={llevas}
          total={meta}
          diametro={anillo.reto}
          trazo={anillo.trazoReto}
          etiqueta={`Reto de la semana: ${llevas} de ${meta} aciertos`}
        />
      </View>
      <Text style={styles.cuerpo}>
        {cumplido
          ? 'Cumplido. La semana que entra empieza otro.'
          : 'Cuenta lo que aciertas estudiando y jugando. No hay reloj y no se pierde.'}
      </Text>
      {cumplido ? null : <Badge label={textoDiasReto(diasQueQuedan(desde, hoy))} tone="accent" />}
    </Card>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  texto: { flex: 1, gap: space.xs },
  titulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  numero: {
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.md,
    fontVariant: ['tabular-nums'],
    color: color.accent,
  },
  cuerpo: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
});
