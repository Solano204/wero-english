import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon, type IconName } from '@/shared/ui';
import { color, escalon, font, radius, space } from '@/theme';
import { conteo } from '@/domain/texto';
import { BarraFina } from '@/shared/ui/BarraFina';
import { textoJuego, type ResumenJuego } from './datos';

/** Lado de la ficha del ícono. */
const FICHA = 40;

interface Props {
  nombre: string;
  icono: IconName;
  resumen: ResumenJuego;
  /** false en Cázala: no usa niveles, así que no hay barra que llenar. */
  conNiveles: boolean;
  indice: number;
  /** La barra se llena al pasar a true (la sección entró a la vista). */
  activo: boolean;
  onPress: () => void;
}

/**
 * Una ficha de «Por juego»: ícono, nombre, «Nivel N de 200», las estrellas y una barra
 * fina de nivel/200. Sin partidas dice «Sin jugar» y la barra queda vacía. Toda la ficha
 * abre el juego.
 */
export function FichaJuego({ nombre, icono, resumen, conNiveles, indice, activo, onPress }: Props) {
  const texto = textoJuego(resumen);
  const estrellas = resumen.tipo === 'nivel' ? resumen.estrellas : 0;
  const etiqueta = estrellas > 0 ? `${nombre}. ${texto}, ${conteo(estrellas, 'estrella')}` : `${nombre}. ${texto}`;
  return (
    <Card onPress={onPress} accessibilityLabel={etiqueta} style={styles.ficha}>
      <View style={styles.cabeza}>
        <View style={styles.icono}>
          <Icon name={icono} size="lg" color={color.textMuted} />
        </View>
        <Text style={styles.nombre}>{nombre}</Text>
      </View>
      <Text style={resumen.tipo === 'sinJugar' ? styles.sinJugar : styles.texto}>{texto}</Text>
      {estrellas > 0 ? (
        <View style={styles.estrellas}>
          <Icon name="star-filled" size="sm" color={color.star} />
          <Text style={styles.cuenta}>{estrellas}</Text>
        </View>
      ) : null}
      {conNiveles ? (
        <BarraFina
          fraccion={resumen.tipo === 'nivel' ? resumen.fraccion : 0}
          tinte={color.accent}
          activo={activo}
          retraso={escalon(indice)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  ficha: { flex: 1 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icono: {
    width: FICHA,
    height: FICHA,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: { flexShrink: 1, fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  texto: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  sinJugar: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textFaint },
  estrellas: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  cuenta: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, fontVariant: ['tabular-nums'], color: color.text },
});
