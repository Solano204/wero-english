import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent, type TextStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { Trozo } from '@/domain/lectura';
import { color, font, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

/** Tamaño e interlineado del texto de la lectura. El esqueleto del lector usa los mismos. */
export const TAMANO_LECTURA = font.size.lg;
/** Una lectura pide más aire que una tarjeta: 1.6 de interlineado es la diferencia entre leer y descifrar. */
export const RENGLON_LECTURA = font.size.lg * 1.6;
/** Aire arriba y abajo de cada oración, y arriba de cada párrafo nuevo. */
export const AIRE_ORACION = space.xs;
export const AIRE_PARRAFO = space.md;

// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const TEXTO = color.text;
const APAGADO = color.textMuted;

/** Una frase que el usuario ya vio: subrayada y en `textMuted`. */
export const ESTILO_FRASE_VISTA: TextStyle = { color: color.textMuted, textDecorationLine: 'underline' };
/** Una frase nueva: `accent`, más peso y subrayado punteado (el punteado y su color solo existen en iOS). */
export const ESTILO_FRASE_NUEVA: TextStyle = {
  color: color.accent,
  fontFamily: font.family.bodyStrong,
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
  textDecorationColor: color.accent,
};

/**
 * Lo que oye el lector de pantalla de una oración: el texto, con cada frase del catálogo diciendo si ya se vio o es
 * nueva. Nunca es solo el color (ni el subrayado sólido o punteado) lo que lo dice.
 */
export function etiquetaOracion(trozos: readonly Trozo[]): string {
  return trozos
    .map((t) => (t.entryId === null ? t.texto : `${t.texto} (${t.nueva ? 'nueva, abre su ficha' : 'ya la viste'})`))
    .join('');
}

interface Props {
  indice: number;
  /** Los trozos de esta oración: texto suelto y frases del catálogo. */
  trozos: Trozo[];
  /** Empieza un párrafo (que no es el primero): lleva más aire arriba. */
  separada: boolean;
  /** La oración que suena, en el hilo de UI (-1 si ninguna). */
  actual: SharedValue<number>;
  /** 1 mientras el capítulo suena o está en pausa: las demás oraciones bajan a `textMuted`. */
  enCurso: SharedValue<number>;
  /** Hay audio: la oración ofrece «Escuchar desde aquí». */
  conAudio: boolean;
  /** Se tocó una frase del catálogo de esta oración. */
  alFrase: (entryId: number, indice: number) => void;
  /** Se tocó la oración (fuera de una frase del catálogo). */
  alOracion: (indice: number) => void;
  /** Dónde quedó la oración dentro del texto, en dp. */
  alMedir: (indice: number, y: number, alto: number) => void;
}

/**
 * Una oración del capítulo. Es un componente con `memo`: el índice de la que suena vive en un valor compartido y cada
 * oración solo lee ese valor en el hilo de UI, así que resaltar la siguiente no vuelve a pintar el texto. La que suena
 * va en `text` y las demás bajan a `textMuted` mientras el capítulo suena. Las frases del catálogo se tocan y abren su
 * ficha: la ya vista lleva subrayado y `textMuted`; la nueva, `accent`, más peso y subrayado punteado (el punteado y su
 * color solo existen en iOS; en Android la nueva se distingue por el color y el peso, y el lector siempre lo dice).
 */
export const Oracion = memo(function Oracion({ indice, trozos, separada, actual, enCurso, conAudio, alFrase, alOracion, alMedir }: Props) {
  const reducido = useMovimientoReducido();
  const apagada = useSharedValue(0);

  useAnimatedReaction(
    () => (enCurso.get() === 1 && actual.get() !== indice ? 1 : 0),
    (ahora, antes) => {
      if (ahora === antes) return;
      apagada.set(reducido ? ahora : withTiming(ahora, { duration: motionDuration.base, easing: motionEasing.entrar }));
    },
    [indice, reducido]
  );
  const estilo = useAnimatedStyle(() => ({ color: interpolateColor(apagada.get(), [0, 1], [TEXTO, APAGADO]) }));

  const etiqueta = etiquetaOracion(trozos);
  const acciones = useMemo(() => {
    const lista: { name: string; label: string }[] = [];
    const vistas = new Set<number>();
    for (const t of trozos) {
      if (t.entryId === null || vistas.has(t.entryId)) continue;
      vistas.add(t.entryId);
      lista.push({ name: `frase-${t.entryId}`, label: `Abrir la ficha de ${t.texto}` });
    }
    if (conAudio) lista.push({ name: 'escuchar', label: 'Escuchar desde aquí' });
    return lista;
  }, [trozos, conAudio]);

  const alAccion = (e: AccessibilityActionEvent) => {
    const nombre = e.nativeEvent.actionName;
    if (nombre === 'escuchar') alOracion(indice);
    else if (nombre.startsWith('frase-')) alFrase(Number(nombre.slice('frase-'.length)), indice);
  };

  return (
    <View
      style={[styles.bloque, separada && styles.separada]}
      onLayout={(e) => alMedir(indice, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
    >
      <Animated.Text
        style={[styles.oracion, estilo]}
        onPress={() => alOracion(indice)}
        accessibilityLabel={etiqueta}
        accessibilityActions={acciones}
        onAccessibilityAction={alAccion}
      >
        {trozos.map((t, i) =>
          t.entryId === null ? (
            <Text key={i}>{t.texto}</Text>
          ) : (
            <Text
              key={i}
              style={t.nueva ? styles.fraseNueva : styles.fraseVista}
              onPress={() => alFrase(t.entryId as number, indice)}
              accessibilityRole="link"
            >
              {t.texto}
            </Text>
          )
        )}
      </Animated.Text>
    </View>
  );
});

const styles = StyleSheet.create({
  bloque: { paddingVertical: AIRE_ORACION },
  separada: { marginTop: AIRE_PARRAFO },
  oracion: {
    fontFamily: font.family.body,
    fontSize: TAMANO_LECTURA,
    lineHeight: RENGLON_LECTURA,
  },
  fraseVista: ESTILO_FRASE_VISTA,
  fraseNueva: ESTILO_FRASE_NUEVA,
});
