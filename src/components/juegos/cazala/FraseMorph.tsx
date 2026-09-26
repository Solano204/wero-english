import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { aparecer, color, escalon, font, motionCaza, motionEasing, motionEscalon, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';

/** El ancho de cada letra (dp): las letras van en celdas fijas para que el chip no cambie de tamaño al transformarse. */
const CELDA = 10;
/** Cuánto sube la letra que se va y baja la que llega (dp). */
const DESPLAZA = 6;
const LINEA = font.size.md * 1.3;
const ESCALON = motionEscalon.ms;
const LETRA = motionCaza.letra;

/** Una reducción de la frase, con el segundo del audio en que suena. */
export interface ItemMorph {
  reducida: string;
  completa: string | null;
  suena: string | null;
  t: number;
}

interface CeldaProps {
  a: string;
  b: string;
  indice: number;
  total: number;
  progreso: SharedValue<number>;
}

/** Una letra que cambia: la vieja sube y se va, la nueva baja y llega, cada una a su turno. */
function CeldaMorph({ a, b, indice, total, progreso }: CeldaProps) {
  const sale = useAnimatedStyle(() => {
    const l = Math.min(1, Math.max(0, (progreso.value * total - indice * ESCALON) / LETRA));
    return { opacity: 1 - l, transform: [{ translateY: -l * DESPLAZA }] };
  });
  const entra = useAnimatedStyle(() => {
    const l = Math.min(1, Math.max(0, (progreso.value * total - indice * ESCALON) / LETRA));
    return { opacity: l, transform: [{ translateY: (1 - l) * DESPLAZA }] };
  });
  return (
    <View style={styles.celda}>
      <Animated.Text style={[styles.letra, styles.encima, sale]}>{a}</Animated.Text>
      <Animated.Text style={[styles.letra, styles.encima, entra]}>{b}</Animated.Text>
    </View>
  );
}

interface ChipProps {
  item: ItemMorph;
  indice: number;
  /** La posición del audio (o la de su reloj sin voz): la transformación arranca al pasar por `item.t`. */
  pos: SharedValue<number>;
  /** Sin movimiento: aparece ya la forma completa, con un fundido. */
  estatico: boolean;
}

/** «chillin'» que se convierte en «chilling» letra por letra cuando el karaoke pasa por esa palabra. */
function ChipMorph({ item, indice, pos, estatico }: ChipProps) {
  const desde = item.reducida;
  const hasta = item.completa ?? item.reducida;
  const n = Math.max(desde.length, hasta.length);
  const total = LETRA + (n - 1) * ESCALON;
  const progreso = useSharedValue(0);
  const t = item.t;

  useAnimatedReaction(
    () => !estatico && pos.value >= t,
    (ya, antes) => {
      if (ya && !antes) progreso.value = withTiming(1, { duration: total, easing: motionEasing.lineal });
    },
    [pos, t, total, estatico]
  );

  const etiqueta = `${desde}, forma completa: ${hasta}`;
  if (estatico) {
    return (
      <Animated.View entering={aparecer(escalon(indice))} style={styles.chip} accessible accessibilityLabel={etiqueta}>
        <Text style={styles.letraFija}>{hasta}</Text>
      </Animated.View>
    );
  }
  return (
    <View style={styles.chip} accessible accessibilityLabel={etiqueta}>
      {Array.from({ length: n }, (_, k) => {
        const a = desde[k] ?? '';
        const b = hasta[k] ?? '';
        return a === b ? (
          <View key={k} style={styles.celda}>
            <Text style={styles.letra}>{a}</Text>
          </View>
        ) : (
          <CeldaMorph key={k} a={a} b={b} indice={k} total={total} progreso={progreso} />
        );
      })}
    </View>
  );
}

/** Las de «suena» (little → «lirol») no se transforman: se ven tal cual y dicen cómo suenan. */
function ChipSuena({ item, indice }: { item: ItemMorph; indice: number }) {
  return (
    <Animated.View
      entering={aparecer(escalon(indice))}
      style={[styles.chip, styles.chipSuena]}
      accessible
      accessibilityLabel={`${item.reducida}, suena ${item.suena}`}
    >
      <Text style={styles.letraFija}>{item.reducida}</Text>
      <Text style={styles.suena}>{`suena «${item.suena}»`}</Text>
    </Animated.View>
  );
}

interface Props {
  /** Las reducciones que tienen algo que mostrar (forma completa o cómo suenan), en el orden en que suenan. */
  reducciones: ItemMorph[];
  pos: SharedValue<number>;
}

/**
 * La forma completa de cada reducción: un chip por reducción que se transforma en su forma completa, una tras otra,
 * cuando el karaoke pasa por ella. Las letras que no cambian se quedan quietas. Con «reducir movimiento» no hay
 * transformación: aparece la forma completa con un fundido.
 */
export function FraseMorph({ reducciones, pos }: Props) {
  const estatico = useMovimientoReducido();
  if (reducciones.length === 0) return null;
  return (
    <View style={styles.fila}>
      {reducciones.map((r, i) =>
        r.completa ? (
          <ChipMorph key={r.reducida} item={r} indice={i} pos={pos} estatico={estatico} />
        ) : (
          <ChipSuena key={r.reducida} item={r} indice={i} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    backgroundColor: color.accentSoft,
  },
  chipSuena: { gap: space.sm },
  celda: { width: CELDA, height: LINEA, alignItems: 'center', justifyContent: 'center' },
  letra: {
    width: CELDA * 2,
    textAlign: 'center',
    fontFamily: font.family.heading,
    fontSize: font.size.md,
    lineHeight: LINEA,
    color: color.text,
  },
  // Las dos letras de una celda que cambia van una sobre otra, centradas aunque sean más anchas que la celda.
  encima: { position: 'absolute', left: -CELDA / 2 },
  letraFija: { fontFamily: font.family.heading, fontSize: font.size.md, lineHeight: LINEA, color: color.text },
  suena: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted },
});
