import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { Presionable } from '@/shared/ui/Presionable';
import { BordePunteado } from '@/shared/ui/fx/BordePunteado';
import {
  color,
  escalon,
  font,
  layout,
  motionCaza,
  motionDuration,
  motionEasing,
  motionPulso,
  radius,
  space,
  tarjetaEntra,
  tarjetaSale,
} from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { Reticulo } from './Reticulo';

/**
 * Cómo está un renglón. Antes de revisar: `libre` o `marcada`. Al revisar, cada uno se distingue por forma e
 * ícono, no solo por color: `cazada` (marcada y correcta), `perdida` (correcta y sin marcar), `noIba` (marcada
 * e incorrecta) y `atenuada` (sin marcar y no iba).
 */
export type EstadoRenglon = 'libre' | 'marcada' | 'cazada' | 'perdida' | 'noIba' | 'atenuada';

const APARIENCIA: Record<EstadoRenglon, { fondo: string; borde: string }> = {
  libre: { fondo: color.surface, borde: color.border },
  marcada: { fondo: color.accentSoft, borde: color.accentBorde },
  cazada: { fondo: color.correctFondo, borde: color.correct },
  perdida: { fondo: 'transparent', borde: 'transparent' },
  noIba: { fondo: color.wrongFondo, borde: color.wrong },
  atenuada: { fondo: color.surface, borde: color.border },
};

const LADO_CASILLA = 24;
const GROSOR_CASILLA = 2;
const MITAD_RAPIDO = motionDuration.rapido / 2;
const MITAD_BASE = motionDuration.base / 2;
/** Los renglones que no se marcaron cuando ya hay tres: se pueden desmarcar otros, pero bajan un poco. */
const OPACIDAD_BAJADA = 0.6;
const OPACIDAD_ATENUADA = 0.45;

const etiquetaA11y = (label: string, estado: EstadoRenglon): string => {
  if (estado === 'cazada') return `${label}. La cazaste`;
  if (estado === 'perdida') return `${label}. Se te fue: esta sí iba`;
  if (estado === 'noIba') return `${label}. No iba`;
  return label;
};

interface Props {
  label: string;
  indice: number;
  estado: EstadoRenglon;
  /** Ya hay tres marcadas: este renglón no lo está y baja de opacidad (sigue tocable). */
  bajada: boolean;
  /** Teléfono de poco alto: renglón de 48 en lugar de 56. */
  compacta: boolean;
  /** La reducción de este renglón: va de vuelta en `onPress`, así la función es la misma para los seis. */
  id: number;
  onPress: (id: number) => void;
  /** Solo al revisar y en las reducciones correctas: la posición del audio y el segundo en que suena esta. */
  caceria: { pos: SharedValue<number>; t: number } | null;
}

/**
 * Un renglón de Cázala: a la izquierda una casilla que se llena de `accent` con su palomita, y un retículo que
 * se cierra sobre el renglón marcado. Al revisar, el renglón muestra qué pasó con esa reducción (ver `EstadoRenglon`)
 * y, en las correctas, late una vez cuando el karaoke de la frase llega a ella. Con «reducir movimiento» no hay
 * retículo, pulsos ni sacudida: solo el borde, el fondo y el ícono.
 */
/** Memo: al marcar uno, los otros cinco reciben las mismas props y no se repintan. */
export const RenglonCaza = memo(function RenglonCaza({ label, indice, estado, bajada, compacta, id, onPress, caceria }: Props) {
  const reducido = useMovimientoReducido();
  const [tam, setTam] = useState({ ancho: 0, alto: 0 });
  const marcada = estado === 'marcada' || estado === 'cazada' || estado === 'noIba';
  const interactivo = estado === 'libre' || estado === 'marcada';

  const opacidad = useSharedValue(1);
  const pulso = useSharedValue(1);
  const casilla = useSharedValue(1);
  const previo = useRef<EstadoRenglon>(estado);

  const objetivo = estado === 'atenuada' ? OPACIDAD_ATENUADA : bajada ? OPACIDAD_BAJADA : 1;
  useEffect(() => {
    opacidad.set(withTiming(objetivo, { duration: motionDuration.base, easing: motionEasing.entrar }));
  }, [objetivo, opacidad]);

  // La casilla pulsa 1 → 1.1 → 1 al marcarla.
  useEffect(() => {
    if (estado === 'marcada' && previo.current !== 'marcada' && !reducido) {
      casilla.set(withSequence(
        withTiming(motionCaza.casilla, { duration: MITAD_RAPIDO, easing: motionEasing.entrar }),
        withTiming(1, { duration: MITAD_RAPIDO, easing: motionEasing.salir })
      ));
    }
    previo.current = estado;
  }, [estado, reducido, casilla]);

  // El renglón late cuando la posición del audio pasa por su reducción.
  const pos = caceria?.pos;
  const t = caceria?.t ?? -1;
  useAnimatedReaction(
    () => !reducido && pos !== undefined && t >= 0 && pos.get() >= t,
    (ya, antes) => {
      if (ya && !antes) {
        pulso.set(withSequence(
          withTiming(motionPulso.escala, { duration: MITAD_BASE, easing: motionEasing.entrar }),
          withTiming(1, { duration: MITAD_BASE, easing: motionEasing.salir })
        ));
      }
    },
    [pos, t, reducido]
  );

  const estiloFila = useAnimatedStyle(() => ({ opacity: opacidad.get(), transform: [{ scale: pulso.get() }] }));
  const estiloCasilla = useAnimatedStyle(() => ({ transform: [{ scale: casilla.get() }] }));

  const { fondo, borde } = APARIENCIA[estado];

  return (
    <Animated.View
      entering={tarjetaEntra().delay(escalon(indice))}
      exiting={tarjetaSale().delay(escalon(indice))}
    >
      <Presionable
        onPress={() => onPress(id)}
        disabled={!interactivo}
        accessibilityRole="checkbox"
        accessibilityLabel={etiquetaA11y(label, estado)}
        accessibilityState={{ checked: marcada, disabled: !interactivo }}
        resultado={estado === 'noIba' ? 'fallo' : null}
      >
        <Animated.View
          style={[styles.fila, { minHeight: compacta ? layout.tapMin : layout.filaModo, backgroundColor: fondo, borderColor: borde }, estiloFila]}
          onLayout={(e) => {
            const { width: ancho, height: alto } = e.nativeEvent.layout;
            // El mismo tamaño no vuelve a pintar el renglón (marcar cambia la fuente y dispara un onLayout).
            setTam((t) => (t.ancho === ancho && t.alto === alto ? t : { ancho, alto }));
          }}
        >
          {estado === 'perdida' && tam.ancho > 0 ? <BordePunteado ancho={tam.ancho} alto={tam.alto} tono={color.correct} /> : null}

          <Animated.View
            style={[
              styles.casilla,
              estado === 'marcada' && styles.casillaMarcada,
              estado === 'cazada' && styles.casillaCazada,
              estado === 'noIba' && styles.casillaNoIba,
              estado === 'perdida' && styles.casillaSola,
              estiloCasilla,
            ]}
          >
            {estado === 'marcada' || estado === 'cazada' ? <Icon name="check" size="md" color={color.onAccent} /> : null}
            {estado === 'noIba' ? <Icon name="close" size="md" color={color.wrong} /> : null}
            {estado === 'perdida' ? <Icon name="reveal" size="lg" color={color.correct} /> : null}
          </Animated.View>

          <Text style={[styles.texto, marcada && styles.textoMarcado]}>{label}</Text>
          {estado === 'perdida' ? <Text style={styles.etiqueta}>Esta sí iba</Text> : null}

          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Reticulo activo={estado === 'marcada'} />
          </View>
        </Animated.View>
      </Presionable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  casilla: {
    width: LADO_CASILLA,
    height: LADO_CASILLA,
    borderRadius: radius.sm,
    borderWidth: GROSOR_CASILLA,
    borderColor: color.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaMarcada: { backgroundColor: color.accent, borderColor: color.accent },
  casillaCazada: { backgroundColor: color.correct, borderColor: color.correct },
  casillaNoIba: { borderColor: color.wrong },
  casillaSola: { borderWidth: 0 },
  texto: {
    flex: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.4,
    color: color.text,
  },
  textoMarcado: { fontFamily: font.family.heading },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.textMuted },
});
