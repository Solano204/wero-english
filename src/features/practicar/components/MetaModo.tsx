import React, { type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Badge, Icon } from '@/shared/ui';
import { color, font, motionDuration, motionEasing } from '@/theme';
import { conteo } from '@/domain/texto';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { consumirPulsoNuevo, pulsoNuevoPendiente } from '@/features/practicar/logic/entrada';
import type { Avance } from './GrupoPlegable';
import type { Meta } from '@/features/practicar/logic/metadatos';

/** Hasta dónde baja la opacidad en el único pulso de «nuevo». */
const PULSO_MIN = 0.35;

/** «nuevo» pulsa una sola vez por sesión, cuando el renglón entra a la vista (al terminar de abrir su grupo). */
function PulsoNuevo({ avance, children }: { avance?: Avance; children: ReactNode }) {
  const reducido = useMovimientoReducido();
  const opacidad = useSharedValue(1);
  const pendiente = useSharedValue(pulsoNuevoPendiente());

  useAnimatedReaction(
    () => (avance ? avance.progreso.get() : 1),
    (progreso) => {
      if (progreso < 1 || !pendiente.get()) return;
      pendiente.set(false);
      runOnJS(consumirPulsoNuevo)();
      if (reducido) return;
      opacidad.set(withSequence(
        withTiming(PULSO_MIN, { duration: motionDuration.base, easing: motionEasing.entrar }),
        withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar })
      ));
    },
    [reducido]
  );

  const estilo = useAnimatedStyle(() => ({ opacity: opacidad.get() }));
  return <Animated.View style={estilo}>{children}</Animated.View>;
}

/**
 * El dato de un renglón como `Badge`: nivel y estrellas, «nuevo», frases atoradas
 * con su punto ámbar, guardadas con su estrella, o un texto corto.
 */
export function MetaModo({ meta, avance }: { meta: Meta; avance?: Avance }) {
  switch (meta.tipo) {
    case 'nivel':
      return (
        <Badge label={`Nivel ${meta.nivel}`} small>
          {meta.estrellas > 0 ? (
            <>
              <Icon name="star-filled" size="sm" color={color.star} />
              <Text style={styles.estrellas}>{meta.estrellas}</Text>
            </>
          ) : null}
        </Badge>
      );
    case 'nuevo':
      return (
        <PulsoNuevo avance={avance}>
          <Badge label="nuevo" tone="accent" small />
        </PulsoNuevo>
      );
    case 'atoradas':
      return <Badge label={conteo(meta.n, 'frase')} punto={color.wrong} small />;
    case 'guardadas':
      return <Badge label={conteo(meta.n, 'guardada')} icono="star-filled" iconoColor={color.star} small />;
    case 'texto':
      return <Badge label={meta.texto} small />;
  }
}

const styles = StyleSheet.create({
  estrellas: { fontFamily: font.family.body, fontSize: font.size.xs, fontVariant: ['tabular-nums'], color: color.textMuted },
});
