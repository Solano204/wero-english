import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/shared/ui/Icon';
import { Presionable } from '@/shared/ui/Presionable';
import { BarraFina } from '@/shared/ui/BarraFina';
import { avisoBloqueo, tituloTramo, type Tramo } from '@/domain/niveles';
import { color, font, layout, space, text } from '@/theme';
import { conteo, miles } from '@/domain/texto';

/**
 * Aire entre el encabezado y la primera fila: el anillo y la onda de la celda actual (hasta 0.3 de su lado
 * fuera de ella, unos 17 dp) no llegan a tocar el texto del tramo. Es parte del encabezado, que es opaco:
 * al pegarse arriba tapa también esta franja.
 */
export const ESPACIO_TRAS_TRAMO = space.xl;

/** Alto fijo del encabezado: la lista calcula sus posiciones con él (`getItemLayout`). */
export const ALTO_TRAMO = 72 + ESPACIO_TRAS_TRAMO;

interface Props {
  tramo: Tramo;
  /** Un tramo completo está plegado a este encabezado hasta que se expande. */
  expandido: boolean;
  onAlternar: (id: string) => void;
}

/**
 * El encabezado de un tramo: «Niveles 1–70» en `h3`, «N frases» en `sm` muted y, a la
 * derecha, las estrellas del tramo con una barra fina en `star`. Se queda pegado arriba
 * mientras se recorre el tramo. Completo (todas las estrellas): `star-filled` y un
 * chevron para expandirlo. Bloqueado: candado y lo que falta para abrirlo.
 * `accessibilityRole="header"`, y el alto es fijo (los textos no pasan de 1.2 veces).
 */
export const EncabezadoTramo = memo(function EncabezadoTramo({ tramo, expandido, onAlternar }: Props) {
  const completo = tramo.estado === 'completo';
  const bloqueado = tramo.estado === 'bloqueado';
  const estrellas = `${miles(tramo.estrellas)} de ${miles(tramo.maximo)}`;

  const contenido = (
    <View style={styles.fila}>
      {completo ? <Icon name="star-filled" size="md" color={color.star} /> : null}
      {bloqueado ? <Icon name="lock" size="md" color={color.textFaint} /> : null}

      <View style={styles.textos}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.2}
          style={[text.h3, styles.titulo, bloqueado && styles.apagado]}
        >
          {tituloTramo(tramo)}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.sub}>
          {bloqueado ? avisoBloqueo(tramo) : conteo(tramo.frases, 'frase')}
        </Text>
      </View>

      {bloqueado ? null : (
        <View style={styles.derecha}>
          <Text maxFontSizeMultiplier={1.2} style={styles.estrellas}>
            {estrellas}
          </Text>
          {completo ? (
            <Icon name={expandido ? 'chevron-up' : 'chevron-down'} size="md" color={color.textMuted} />
          ) : (
            <Icon name="star-filled" size="sm" color={color.star} />
          )}
        </View>
      )}
    </View>
  );

  const barra = bloqueado ? null : (
    <View style={styles.barra}>
      <BarraFina fraccion={tramo.maximo > 0 ? tramo.estrellas / tramo.maximo : 0} tinte={color.star} activo />
    </View>
  );

  return (
    <View style={styles.wrap}>
      {completo ? (
        <Presionable
          onPress={() => onAlternar(tramo.id)}
          accessibilityRole="button"
          accessibilityLabel={`${tituloTramo(tramo)}, completo, ${estrellas} estrellas`}
          accessibilityHint={expandido ? 'Pliega el tramo' : 'Muestra los niveles del tramo'}
          accessibilityState={{ expanded: expandido }}
          style={styles.toque}
        >
          {contenido}
        </Presionable>
      ) : (
        <View
          style={styles.toque}
          accessible={bloqueado}
          accessibilityLabel={bloqueado ? `${tituloTramo(tramo)}, bloqueado. ${avisoBloqueo(tramo)}` : undefined}
        >
          {contenido}
        </View>
      )}
      {barra}
    </View>
  );
});

const styles = StyleSheet.create({
  // Opaco: al pegarse arriba tapa lo que pasa por debajo.
  wrap: {
    height: ALTO_TRAMO,
    backgroundColor: color.bg,
    paddingHorizontal: layout.screenPad,
    paddingBottom: ESPACIO_TRAS_TRAMO,
    justifyContent: 'center',
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  toque: { minHeight: layout.tapMin, justifyContent: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  textos: { flex: 1, gap: space.xs },
  titulo: { color: color.text },
  apagado: { color: color.textMuted },
  sub: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  derecha: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  estrellas: { fontFamily: font.family.body, fontSize: font.size.sm, fontVariant: ['tabular-nums'], color: color.textMuted },
  barra: { height: 4 },
});
