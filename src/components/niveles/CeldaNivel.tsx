import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/base/Icon';
import { Presionable } from '@/components/base/Presionable';
import { FilaEstrellas } from '@/components/card/FilaEstrellas';
import { etiquetaNivel, type EstadoNivel } from '@/domain/niveles';
import { color, font, layout, radius, senal, space } from '@/theme';
import { AnilloActual } from './AnilloActual';
import { BordePunteado } from './BordePunteado';

/** La celda actual es un 12 % más grande que sus vecinas: escala, sin mover la cuadrícula. */
export const ESCALA_ACTUAL = 1.12;

interface Props {
  n: number;
  estado: EstadoNivel;
  estrellas: number;
  /** Lado de la celda (dp): sale del ancho de la pantalla, nunca menos de 48. */
  lado: number;
  onPress: (n: number, estado: EstadoNivel) => void;
}

/**
 * Una celda del mapa de niveles. Cada estado se reconoce sin depender del color:
 *  - perfecto: `surface` con un filo dorado y tres estrellas llenas;
 *  - hecho: `surface` con las estrellas que tiene;
 *  - abierto sin jugar: `surfaceAlt` con tres estrellas vacías;
 *  - actual: el degradado `senal`, más grande, con el número en `onAccent`;
 *  - con anuncio: borde punteado, `play` y «Anuncio»;
 *  - bloqueado: el fondo, el número apagado y un candado.
 * El verde (`correct`) no se usa aquí: es del estado de un juego, no de esta cuadrícula.
 * Está en `memo`: con hasta doscientas celdas, solo se repinta la que cambia.
 */
export const CeldaNivel = memo(function CeldaNivel({ n, estado, estrellas, lado, onPress }: Props) {
  const actual = estado === 'actual';
  const anuncio = estado === 'anuncio';
  const bloqueado = estado === 'bloqueado';
  const conEstrellas = estado === 'perfecto' || estado === 'hecho' || estado === 'abierto' || actual;

  return (
    <Presionable
      onPress={() => onPress(n, estado)}
      disabled={bloqueado}
      accessibilityRole="button"
      accessibilityLabel={etiquetaNivel(n, estado, estrellas)}
      accessibilityHint={anuncio ? 'Ver anuncio y abrir' : undefined}
      accessibilityState={{ disabled: bloqueado }}
      // La actual va por encima de sus vecinas: su anillo y su onda se apoyan en el hueco.
      style={{ width: lado, height: lado, zIndex: actual ? 1 : 0 }}
    >
      {actual ? <AnilloActual lado={lado} /> : null}
      <View
        style={[
          styles.celda,
          { width: lado, height: lado },
          estado === 'perfecto' && styles.perfecto,
          estado === 'abierto' && styles.abierto,
          anuncio && styles.anuncio,
          bloqueado && styles.bloqueado,
          actual && styles.actual,
        ]}
      >
        {actual ? <LinearGradient colors={senal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
        {anuncio ? <BordePunteado lado={lado} /> : null}

        <Text
          maxFontSizeMultiplier={1.2}
          style={[styles.numero, actual && styles.numeroActual, bloqueado && styles.numeroApagado]}
        >
          {n}
        </Text>

        {conEstrellas ? (
          <FilaEstrellas
            llenas={actual ? 0 : estrellas}
            color={color.star}
            colorVacia={actual ? color.onAccent : color.textFaint}
          />
        ) : null}
        {anuncio ? (
          <>
            <View style={styles.play}>
              <Icon name="play" size="sm" color={color.accent} />
            </View>
            <Text maxFontSizeMultiplier={1.2} style={styles.etiquetaAnuncio}>
              Anuncio
            </Text>
          </>
        ) : null}
        {bloqueado ? <Icon name="lock" size="sm" color={color.textFaint} /> : null}
      </View>
    </Presionable>
  );
});

const styles = StyleSheet.create({
  // Sin sombra por celda, a propósito: son hasta doscientas en una lista y en Android cada
  // `elevation` es una capa aparte que traba el scroll en gama media.
  celda: {
    minWidth: layout.tapMin,
    minHeight: layout.tapMin,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    overflow: 'hidden',
  },
  perfecto: { borderWidth: 1, borderColor: color.starFilo },
  abierto: { backgroundColor: color.surfaceAlt },
  anuncio: { backgroundColor: color.surfaceAlt, borderWidth: 1, borderColor: color.accentSoft },
  bloqueado: { backgroundColor: color.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.border },
  actual: { transform: [{ scale: ESCALA_ACTUAL }] },
  numero: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  numeroActual: { color: color.onAccent },
  numeroApagado: { color: color.textFaint },
  play: { position: 'absolute', top: space.xs, right: space.xs },
  etiquetaAnuncio: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.accent },
});
