import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import type { EstadoNivel, NivelVista } from '@/domain/niveles';
import { aparecerSubiendo, layout, motionDuration } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { CeldaNivel } from './CeldaNivel';
import type { Logro } from '@/features/juegos/niveles/hooks/useRecompensaNiveles';

/** Hueco entre celdas, en los dos sentidos (escala 4/8). */
export const HUECO_CELDAS = 8;

interface Props {
  niveles: NivelVista[];
  lado: number;
  onPress: (n: number, estado: EstadoNivel) => void;
  /** Estrellas nuevas por nivel desde la última visita. */
  logros?: ReadonlyMap<number, Logro>;
  saltoActual?: boolean;
  /**
   * Solo mientras entra la pantalla: el renglón aparece con este retraso (`escalon(i)`).
   * `undefined`: sin animación de entrada (los renglones que aparecen al hacer scroll).
   */
  retrasoEntrada?: number;
  /** Las estrellas de este renglón (es del tramo actual) se encienden en cascada, una sola vez. */
  cascada?: boolean;
}

/**
 * Un renglón de la lista: hasta cinco celdas. Su alto es `lado + HUECO_CELDAS`, exacto,
 * porque la lista calcula con él dónde está cada cosa (`getItemLayout`) y a dónde
 * llevar el scroll.
 */
export const FilaNiveles = memo(function FilaNiveles({ niveles, lado, onPress, logros, saltoActual, retrasoEntrada, cascada = false }: Props) {
  const reducido = useMovimientoReducido();
  return (
    <Animated.View
      entering={!reducido && retrasoEntrada !== undefined ? aparecerSubiendo(retrasoEntrada) : undefined}
      style={[styles.fila, { height: lado + HUECO_CELDAS }]}
    >
      {niveles.map((v) => (
        <CeldaNivel
          key={v.n}
          n={v.n}
          estado={v.estado}
          estrellas={v.estrellas}
          lado={lado}
          onPress={onPress}
          logro={logros?.get(v.n)}
          saltoActual={saltoActual}
          cascada={cascada && retrasoEntrada !== undefined ? retrasoEntrada + motionDuration.base : undefined}
        />
      ))}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: HUECO_CELDAS,
    paddingHorizontal: layout.screenPad,
  },
});
