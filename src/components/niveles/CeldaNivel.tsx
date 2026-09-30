import React, { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/shared/ui/Icon';
import { Presionable } from '@/shared/ui/Presionable';
import { etiquetaNivel, type EstadoNivel } from '@/domain/niveles';
import {
  color,
  font,
  layout,
  motionDuration,
  motionEasing,
  motionLogro,
  motionSpring,
  radius,
  senal,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { AnilloActual } from './AnilloActual';
import { BordePunteado } from '@/shared/ui/fx/BordePunteado';
import { DesbloqueoCelda } from './DesbloqueoCelda';
import { EstrellasCelda } from './EstrellasCelda';
import type { Logro } from './useRecompensaNiveles';

/** La celda actual es un 12 % más grande que sus vecinas: escala, sin mover la cuadrícula. */
export const ESCALA_ACTUAL = 1.12;
/** Un logro espera a que termine la entrada de la pantalla. */
export const RETRASO_LOGRO = motionDuration.escena;
/** De qué tamaño llega la celda actual nueva antes de asentarse con el resorte. */
const ESCALA_LLEGADA = 0.8;

interface EfectoProps {
  /** Id del logro: la celda pulsa 1 → 1.06 → 1 cada vez que cambia. */
  pulso?: number;
  /** La celda es el nuevo nivel actual: llega con el resorte `rebote`. */
  llega: boolean;
  children: ReactNode;
}

/** Lo que le pasa a la celda al volver con novedades: el pulso del logro y la llegada del nuevo actual. */
function EfectoCelda({ pulso, llega, children }: EfectoProps) {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(llega && !reducido ? ESCALA_LLEGADA : 1);

  useEffect(() => {
    if (llega && !reducido) escala.value = withDelay(RETRASO_LOGRO, withSpring(1, motionSpring.rebote));
  }, [llega, reducido, escala]);

  useEffect(() => {
    if (pulso === undefined || reducido) return;
    escala.value = withDelay(
      RETRASO_LOGRO,
      withSequence(
        withTiming(motionLogro.escala, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
        withTiming(1, { duration: motionDuration.base, easing: motionEasing.salir })
      )
    );
  }, [pulso, reducido, escala]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

interface Props {
  n: number;
  estado: EstadoNivel;
  estrellas: number;
  /** Lado de la celda (dp): sale del ancho de la pantalla, nunca menos de 48. */
  lado: number;
  onPress: (n: number, estado: EstadoNivel) => void;
  /** Estrellas nuevas desde la última visita: pulso de la celda y estrellas que se encienden una por una. */
  logro?: Logro;
  /** El nivel actual cambió con esta visita: el nuevo actual llega con un resorte. */
  saltoActual?: boolean;
  /** Retraso (ms) de la cascada de estrellas al entrar (solo el tramo actual, solo la primera vez). */
  cascada?: number;
}

/**
 * Una celda del mapa de niveles. Cada estado se reconoce sin depender del color:
 *  - perfecto: `surface` con un filo dorado y tres estrellas llenas;
 *  - hecho: `surface` con las estrellas que tiene;
 *  - abierto sin jugar: `surfaceAlt` con tres estrellas vacías;
 *  - actual: el degradado `senal`, más grande, con el número en `onAccent` y su anillo;
 *  - con anuncio: borde punteado, `play` y «Anuncio»;
 *  - bloqueado: el fondo, el número apagado y un candado.
 * El verde (`correct`) no se usa aquí: es del estado de un juego, no de esta cuadrícula.
 * Está en `memo`: con hasta doscientas celdas, solo se repinta la que cambia.
 */
export const CeldaNivel = memo(function CeldaNivel({ n, estado, estrellas, lado, onPress, logro, saltoActual = false, cascada }: Props) {
  const reducido = useMovimientoReducido();
  const actual = estado === 'actual';
  const anuncio = estado === 'anuncio';
  const bloqueado = estado === 'bloqueado';
  const conEstrellas = estado === 'perfecto' || estado === 'hecho' || estado === 'abierto' || actual;

  // Un anuncio acaba de abrir esta celda: el borde punteado se vuelve sólido y el candado se abre.
  const [desbloqueando, setDesbloqueando] = useState(false);
  const previo = useRef(estado);
  useEffect(() => {
    const venia = previo.current;
    previo.current = estado;
    if (venia !== 'anuncio' || estado !== 'abierto' || reducido) return;
    setDesbloqueando(true);
    const t = setTimeout(() => setDesbloqueando(false), motionDuration.lento + motionDuration.rapido);
    return () => clearTimeout(t);
  }, [estado, reducido]);

  const cuerpo = (
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
      {anuncio ? <BordePunteado ancho={lado} alto={lado} /> : null}
      {desbloqueando ? <DesbloqueoCelda lado={lado} /> : null}

      <Text
        maxFontSizeMultiplier={1.2}
        style={[styles.numero, actual && styles.numeroActual, bloqueado && styles.numeroApagado]}
      >
        {n}
      </Text>

      {conEstrellas ? (
        <EstrellasCelda
          llenas={actual ? 0 : estrellas}
          colorVacia={actual ? color.onPrimario : color.textFaint}
          // Un logro enciende solo las estrellas nuevas (con destello); la cascada de entrada, todas las que tiene.
          encenderDesde={logro ? logro.antes : cascada !== undefined && estrellas > 0 ? 0 : undefined}
          retraso={logro ? RETRASO_LOGRO : (cascada ?? 0)}
          destello={Boolean(logro)}
          entre={logro ? motionLogro.entreEstrellas : motionLogro.cascada}
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
  );

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
      {logro || (actual && saltoActual) ? (
        <EfectoCelda pulso={logro?.id} llega={actual && saltoActual}>
          {cuerpo}
        </EfectoCelda>
      ) : (
        cuerpo
      )}
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
  numeroActual: { color: color.onPrimario },
  numeroApagado: { color: color.textFaint },
  play: { position: 'absolute', top: space.xs, right: space.xs },
  etiquetaAnuncio: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.accent },
});
