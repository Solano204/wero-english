import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { diffLetras } from '@/domain/diff';
import { aparecer, color, font, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';

interface Props {
  /** Lo que escribió el usuario. */
  dado: string;
  /** La frase esperada. */
  esperado: string;
}

/**
 * La frase esperada con lo que salió mal marcado en su lugar: lo que faltó va en
 * ámbar y subrayado, lo que sobró en ámbar, subrayado y tachado (así no depende
 * solo del color). Nunca dice "incorrecto": muestra dónde quedó la diferencia.
 */
export function DiffFrase({ dado, esperado }: Props) {
  const reducido = useMovimientoReducido();
  const tramos = useMemo(() => diffLetras(dado, esperado), [dado, esperado]);

  // Para el lector de pantalla: la frase con lo que faltó y lo que sobró dicho en palabras.
  const descripcion = useMemo(
    () =>
      tramos
        .map((t) => (t.tipo === 'igual' ? t.texto : t.tipo === 'falta' ? `[faltó ${t.texto}]` : `[sobró ${t.texto}]`))
        .join(''),
    [tramos]
  );

  return (
    <Animated.View entering={reducido ? undefined : aparecer()} style={styles.wrap} accessible accessibilityRole="text" accessibilityLabel={descripcion}>
      <Text style={styles.linea}>
        {tramos.map((t, i) => (
          <Text key={`${i}-${t.tipo}`} style={t.tipo === 'igual' ? styles.igual : t.tipo === 'falta' ? styles.falta : styles.extra}>
            {t.texto}
          </Text>
        ))}
      </Text>
      <Text style={styles.leyenda}>Subrayado: lo que faltó. Tachado: lo que sobró.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  linea: { fontFamily: font.family.body, fontSize: font.size.lg, lineHeight: font.size.lg * 1.4, color: color.text },
  igual: { color: color.text },
  falta: { color: color.wrong, fontFamily: font.family.bodyStrong, textDecorationLine: 'underline' },
  extra: {
    color: color.wrong,
    fontFamily: font.family.bodyStrong,
    textDecorationLine: 'underline line-through',
  },
  leyenda: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
});
