import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Rect } from '@/components/fx';
import { sinBarras } from '@/domain/vocales';
import { color, font, layout, space } from '@/theme';
import type { Fonema } from '@/types';
import { SIMBOLO_GRANDE } from './ViajeSimbolo';

/** Cuántos cuadros se espera a que la página termine de acomodarse antes de dar por perdido el símbolo. */
const INTENTOS_MEDIR = 10;

interface Props {
  fonema: Fonema;
  /** Es la página que se ve: la única que anima y suena. */
  esActual: boolean;
  /** El símbolo viaja desde el índice: mientras vuela, el de la página no se ve. */
  simboloOculto: boolean;
  /** Si viene, la página mide su símbolo grande y avisa dónde quedó (para el viaje desde el chip del índice). */
  alSimboloMedido?: (rect: Rect) => void;
}

/** Una página del laboratorio: todo lo de un fonema. */
export function PaginaFonema({ fonema, simboloOculto, alSimboloMedido }: Props) {
  const { width: anchoVentana } = useWindowDimensions();
  const simbolo = useRef<View>(null);

  const medir = useCallback(
    (intento: number) => {
      simbolo.current?.measureInWindow((x, y, width, height) => {
        // La página puede no estar todavía en su lugar (el pager se acomoda un cuadro después de montarse).
        const dentro = width > 0 && x > -width && x < anchoVentana;
        if (dentro) alSimboloMedido?.({ x, y, width, height });
        else if (intento < INTENTOS_MEDIR) requestAnimationFrame(() => medir(intento + 1));
      });
    },
    [alSimboloMedido, anchoVentana]
  );

  useEffect(() => {
    if (alSimboloMedido) medir(0);
  }, [alSimboloMedido, medir]);

  return (
    <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
      <View style={styles.cabeza}>
        <View ref={simbolo} collapsable={false} style={simboloOculto ? styles.oculto : undefined}>
          <Text style={styles.simbolo} accessibilityLabel={fonema.nombre}>
            {sinBarras(fonema.ipa)}
          </Text>
        </View>
        <View style={styles.textos}>
          <Text style={styles.nombre}>{fonema.nombre}</Text>
          <Text style={styles.ancla}>como en {fonema.palabra_ancla}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: layout.screenPad, paddingBottom: space.xxxl, gap: space.lg },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  oculto: { opacity: 0 },
  // Charis SIL solo trae Regular: se compensa con tamaño, no con peso.
  simbolo: {
    fontFamily: font.family.ipa,
    fontSize: SIMBOLO_GRANDE,
    letterSpacing: SIMBOLO_GRANDE * -0.015,
    color: color.accent,
  },
  textos: { flex: 1, gap: space.xs },
  nombre: { fontFamily: font.family.heading, fontSize: font.size.xl, color: color.text },
  ancla: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
});
