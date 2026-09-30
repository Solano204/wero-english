import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button } from '@/shared/ui';
import { aparecer, color, font, radius, space } from '@/theme';

/**
 * Las tres pantallas de bienvenida.
 *
 * No es un tour de funciones. Un tour de funciones se salta y no se
 * recuerda. Son tres promesas concretas, y la del medio es la única que
 * ningún competidor puede hacer: te decimos con quién sí y con quién no.
 */
export const PRESENTACION: {
  titulo: string;
  cuerpo: string;
  pie: string;
  tinte: string;
}[] = [
  {
    titulo: 'Inglés del que de verdad se oye',
    cuerpo:
      'Nada de "the cat is on the table". Aquí está lo que dicen en los streams, en el trabajo y en la calle: 1,524 frases con audio, imagen y su pronunciación.',
    pie: 'Ocho mundos, de Día a día a Calle y jerga.',
    tinte: color.world.calle,
  },
  {
    titulo: 'Y con quién NO decirlo',
    cuerpo:
      'Cada frase trae su nivel de riesgo: sabes si va con tus amigos o si te puede costar una entrevista.',
    pie: 'Lo ves en la ficha de cada frase.',
    tinte: color.riskWarn,
  },
  {
    titulo: 'Tres minutos al día, sin castigos',
    cuerpo:
      'Sin vidas y sin cronómetro. Si un día no entras, la app no te lo menciona. Tu avance se queda guardado en tu teléfono aunque vuelvas en un mes.',
    pie: 'Ahora sí, tres preguntas rápidas.',
    tinte: color.correct,
  },
];

export function Presentacion({
  slide,
  onSiguiente,
}: {
  slide: number;
  onSiguiente: () => void;
}) {
  const s = PRESENTACION[slide];
  if (!s) return null;

  return (
    <Animated.View entering={aparecer()} style={styles.paso}>
      <View style={[styles.marca, { backgroundColor: s.tinte }]} />
      <Text style={styles.titulo}>{s.titulo}</Text>
      <Text style={styles.bajada}>{s.cuerpo}</Text>
      <Text style={styles.nota}>{s.pie}</Text>

      <View style={styles.puntos}>
        {PRESENTACION.map((_, i) => (
          <View
            key={i}
            style={[styles.punto, i === slide && styles.puntoOn]}
          />
        ))}
      </View>

      <Button
        label={slide + 1 < PRESENTACION.length ? 'Siguiente' : 'Empezar'}
        onPress={onSiguiente}
        full
        size="lg"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  paso: { gap: space.md },
  titulo: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
  },
  bajada: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  nota: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  marca: {
    width: 48,
    height: 6,
    borderRadius: radius.pill,
    marginBottom: space.md,
  },
  puntos: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xl,
    marginBottom: space.lg,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.border,
  },
  puntoOn: { backgroundColor: color.accent, width: 22 },

});
