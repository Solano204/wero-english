import React, { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AudioButton } from '@/shared/ui/AudioButton';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Marcador } from '@/shared/ui/fx/Marcador';
import { color, escalon, font, motionDuration, motionEasing, radius, shadow, space } from '@/theme';
import { plural } from '@/domain/texto';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Entry } from '@/types';

/** Cuánto suben de abajo el número, la tarjeta y los botones al entrar. */
const SUBE = 24;
/** Tamaño del número de frases seguidas. */
const TAMANO_NUMERO = 64;

interface EntraProps {
  /** Su lugar en la cascada: entra con `escalon(orden)`. */
  orden: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Entra desde abajo con un fundido, en `lento` y con el retraso de su lugar (`escalon`). Con «reducir movimiento» solo el fundido. */
function Entra({ orden, style, children }: EntraProps) {
  const reducido = useMovimientoReducido();
  const avance = useSharedValue(0);

  useEffect(() => {
    avance.value = withDelay(reducido ? 0 : escalon(orden), withTiming(1, { duration: reducido ? motionDuration.rapido : motionDuration.lento, easing: motionEasing.entrar }));
  }, [orden, reducido, avance]);

  const anim = useAnimatedStyle(() => ({
    opacity: avance.value,
    transform: [{ translateY: reducido ? 0 : (1 - avance.value) * SUBE }],
  }));

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** «Récord nuevo»: la estrella y un solo destello dorado, sin confeti (la fiesta la decide GameEnd). */
function RecordNuevo() {
  const reducido = useMovimientoReducido();
  const destello = useSharedValue(0);

  useEffect(() => {
    if (reducido) return;
    destello.value = withDelay(
      motionDuration.lento + escalon(1),
      withSequence(
        withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionDuration.lento, easing: motionEasing.salir })
      )
    );
  }, [reducido, destello]);

  const luz = useAnimatedStyle(() => ({ opacity: destello.value * 0.3 }));

  return (
    <View style={styles.recordNuevo} accessible accessibilityRole="text" accessibilityLabel="Récord nuevo">
      <Animated.View pointerEvents="none" style={[styles.destelloRecord, luz]} />
      <Icon name="star-filled" size="md" color={color.star} />
      <Text style={styles.recordNuevoTexto}>Récord nuevo</Text>
    </View>
  );
}

interface Props {
  /** Las frases que se lograron seguidas: el marcador rueda desde 0. */
  aciertos: number;
  /** La ronda en la que se perdió. */
  entry: Entry;
  /** El significado correcto. */
  correcta: string;
  /** Lo que se eligió, o `null` si se acabó el tiempo. */
  fallada: string | null;
  /** El mejor puntaje del nivel antes de esta partida (0 si no había). */
  record: number;
}

/**
 * El resumen de la partida perdida de Caída, centrado entre el encabezado y el pie. El número de frases
 * seguidas rueda desde 0 con el `Marcador`; debajo, el récord del nivel («Récord: N», o «Récord nuevo» con
 * un destello dorado si esta partida lo supera). La tarjeta trae la frase, su traducción en `correct`, lo
 * que se eligió en `wrong` con ícono (no solo color) y `Escuchar` para oír la frase que se falló. Aquí sí se
 * pierde la partida, pero nada más: la nota lo dice. Entra con `escalon(i)`; sin confeti.
 */
export function FinCaida({ aciertos, entry, correcta, fallada, record }: Props) {
  const nuevo = record > 0 && aciertos > record;
  return (
    <ScrollView style={styles.envoltura} contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
      <Entra orden={0} style={styles.numero}>
        <Marcador
          valor={aciertos}
          tamano={TAMANO_NUMERO}
          color={color.accent}
          retraso={motionDuration.rapido}
          etiqueta={`${aciertos} ${plural(aciertos, 'frase seguida', 'frases seguidas')}`}
        />
        <Text style={styles.etiqueta}>{plural(aciertos, 'frase seguida', 'frases seguidas')}</Text>
      </Entra>

      {record > 0 ? (
        <Entra orden={1}>{nuevo ? <RecordNuevo /> : <Text style={styles.record}>Récord: {record}</Text>}</Entra>
      ) : null}

      <Entra orden={2} style={styles.tarjeta}>
        <Text style={styles.frase}>{entry.phrase}</Text>
        <View style={styles.linea}>
          <Icon name="check" size="md" color={color.correct} />
          <Text style={styles.bien}>{correcta}</Text>
        </View>
        <View style={styles.linea}>
          <Icon name={fallada ? 'close' : 'clock'} size="md" color={color.wrong} />
          <Text style={styles.mal}>{fallada ? `Elegiste: ${fallada}` : 'Se te fue el tiempo'}</Text>
        </View>
        <View style={styles.escuchar}>
          <AudioButton path={entry.audio_en} size="md" label="Escuchar" />
        </View>
      </Entra>

      <Entra orden={3}>
        <Text style={styles.nota}>
          Aquí sí se pierde la partida, pero nada más. Tu racha y tu avance siguen igual.
        </Text>
      </Entra>
    </ScrollView>
  );
}

interface PieProps {
  onOtraVez: () => void;
  onVerResultado: () => void;
}

/** Los dos botones del pie de la partida perdida: «Otra vez» (la acción principal) y «Ver cómo me fue». Entran desde abajo. */
export function PieFinCaida({ onOtraVez, onVerResultado }: PieProps) {
  return (
    <View style={styles.pie}>
      <Entra orden={4}>
        <Button label="Otra vez" icon="repeat" onPress={onOtraVez} full size="lg" />
      </Entra>
      <Entra orden={5}>
        <Button label="Ver cómo me fue" variant="secondary" onPress={onVerResultado} full />
      </Entra>
    </View>
  );
}

const styles = StyleSheet.create({
  envoltura: { flex: 1 },
  // El contenido se centra en el espacio que dejan el encabezado y el pie: sin hueco muerto arriba o abajo.
  contenido: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  numero: { alignItems: 'center', gap: space.xs },
  etiqueta: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  record: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.textMuted },
  recordNuevo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  // El único destello dorado: una banda `star` que se enciende y se apaga detrás de la estrella.
  destelloRecord: { ...StyleSheet.absoluteFill, borderRadius: radius.pill, backgroundColor: color.star },
  recordNuevoTexto: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.star },
  tarjeta: {
    alignSelf: 'stretch',
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    gap: space.sm,
    marginTop: space.md,
    ...shadow.card,
  },
  frase: { fontSize: font.size.lg, fontFamily: font.family.heading, color: color.text },
  linea: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bien: { flexShrink: 1, fontFamily: font.family.body, fontSize: font.size.md, color: color.correct },
  mal: { flexShrink: 1, fontFamily: font.family.body, fontSize: font.size.md, color: color.wrong },
  escuchar: { alignItems: 'flex-start', marginTop: space.xs },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.md,
  },
  // El pie de Screen ya pone el padding y separa del contenido: aquí solo el espacio entre los dos botones.
  pie: { gap: space.sm },
});
